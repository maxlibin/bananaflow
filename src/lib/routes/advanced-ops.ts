import { NextResponse, type NextRequest } from "next/server";
import { runAdvancedOperation, type ProviderResult } from "../advanced-node-pipeline";
import type { AdvancedOpId } from "../advanced-ops";
import type { HostAdapter } from "../host/types";
import type { Provider } from "../providers/types";
import { buildReferenceImages } from "../reference-images";
import { runImageTaskToCompletion } from "../run-image-task";

// Upscale, background removal and face consistency are prompt-engineered
// calls to an editing-capable image model. The model comes from the first
// host provider that declares one, so the same node works on every deployment.

export class NoEditingProviderError extends Error {
  constructor() {
    super("No enabled provider offers an editing model");
    this.name = "NoEditingProviderError";
  }
}

function pickEditingModel(host: HostAdapter): { provider: Provider; model: string } {
  for (const provider of host.providers.list) {
    if (provider.editingModel !== null && host.models.image[provider.editingModel]) {
      return { provider, model: provider.editingModel };
    }
  }
  throw new NoEditingProviderError();
}

async function runEditingModel(
  host: HostAdapter,
  input: {
    userId: string;
    prompt: string;
    referenceUrls: string[];
    settings: Record<string, unknown>;
    signal: AbortSignal;
  },
): Promise<ProviderResult> {
  const { provider, model } = pickEditingModel(host);
  const info = host.models.image[model];
  const secret = await host.keys.resolveProviderKey(input.userId, info.provider);
  const assets = await runImageTaskToCompletion({
    provider,
    task: {
      model,
      providerModel: info.providerModel,
      prompt: input.prompt,
      referenceImages: buildReferenceImages(host, input.referenceUrls),
      settings: input.settings,
      variants: 1,
      callBackUrl: null,
      secret,
      signal: input.signal,
    },
    pollIntervalMs: 5000,
    maxPolls: 60,
  });
  const first = assets[0];
  if (!first) throw new Error("Provider returned no image");
  return { buffer: first.bytes, contentType: first.contentType, ext: first.ext };
}

export function createUpscaleRoute(host: HostAdapter) {
  async function POST(request: NextRequest) {
    const body = (await request.clone().json()) as { imageUrl?: string; factor?: 2 | 4 };
    const factor: 2 | 4 = body.factor === 4 ? 4 : 2;
    const op: AdvancedOpId = factor === 4 ? "upscale_4x" : "upscale_2x";

    if (!body.imageUrl) {
      return NextResponse.json({ success: false, error: "imageUrl is required" }, { status: 400 });
    }
    const imageUrl = body.imageUrl;

    return runAdvancedOperation(host, {
      request,
      op,
      feature: "IMAGE_UPSCALE",
      fileNameBase: `upscaled-${factor}x`,
      extraUsageMetadata: { factor, sourceUrl: imageUrl.slice(0, 200) },
      callProvider: ({ signal, userId }) =>
        runEditingModel(host, {
          userId,
          prompt: `Upscale this image to ${factor}x resolution. Preserve all details, sharpness, and colors. Do not change composition.`,
          referenceUrls: [imageUrl],
          settings: { aspectRatio: "auto" },
          signal,
        }),
    });
  }

  return { POST };
}

export function createRemoveBgRoute(host: HostAdapter) {
  async function POST(request: NextRequest) {
    const body = (await request.clone().json()) as { imageUrl?: string };
    if (!body.imageUrl) {
      return NextResponse.json({ success: false, error: "imageUrl is required" }, { status: 400 });
    }
    const imageUrl = body.imageUrl;

    return runAdvancedOperation(host, {
      request,
      op: "remove_bg",
      feature: "BACKGROUND_REMOVAL",
      fileNameBase: "removed-bg",
      extraUsageMetadata: { sourceUrl: imageUrl.slice(0, 200) },
      callProvider: ({ signal, userId }) =>
        runEditingModel(host, {
          userId,
          prompt:
            "Remove the background of this image completely. Output a transparent PNG with only the main subject, cleanly cut out along the edges.",
          referenceUrls: [imageUrl],
          settings: { aspectRatio: "auto", outputFormat: "png" },
          signal,
        }),
    });
  }

  return { POST };
}

export function createFaceConsistencyRoute(host: HostAdapter) {
  async function POST(request: NextRequest) {
    const body = (await request.clone().json()) as {
      prompt?: string;
      referenceImageUrl?: string;
      aspectRatio?: string;
    };

    if (!body.prompt) {
      return NextResponse.json({ success: false, error: "prompt is required" }, { status: 400 });
    }
    if (!body.referenceImageUrl) {
      return NextResponse.json(
        { success: false, error: "referenceImageUrl is required" },
        { status: 400 },
      );
    }
    const prompt = body.prompt;
    const referenceImageUrl = body.referenceImageUrl;
    const aspectRatio = body.aspectRatio ?? "auto";

    return runAdvancedOperation(host, {
      request,
      op: "face_consistency",
      feature: "FACE_CONSISTENCY",
      fileNameBase: "face-consistent",
      extraUsageMetadata: { referenceUrl: referenceImageUrl.slice(0, 200) },
      callProvider: ({ signal, userId }) =>
        runEditingModel(host, {
          userId,
          prompt: `Keep the same face, identity, and distinguishing features as the reference image. Scene: ${prompt}`,
          referenceUrls: [referenceImageUrl],
          settings: { aspectRatio },
          signal,
        }),
    });
  }

  return { POST };
}
