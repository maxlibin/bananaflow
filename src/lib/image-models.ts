export interface BuildBodyOptions {
  aspectRatio?: string;
  imageUrls?: string[];
  imageSize?: string;
  imageResolution?: string;
  quality?: string;
  style?: string;
  renderingSpeed?: string;
  outputFormat?: string;
  nVariants?: number;
}

// Kie.ai-specific request/response description for one model.
export interface ImageModelConfig {
  label: string;
  endpoint: string;
  statusEndpoint: string;
  taskIdField: string;
  statusField: string;
  successStates: readonly (string | number)[];
  failStates: readonly (string | number)[];
  imageUrlField: string;
  costPerImage: number;
  supportsImageInput: boolean;
  supportsBatchGeneration?: boolean;
  maxBatchCount?: number;
  buildBody: (prompt: string, options: BuildBodyOptions) => Record<string, unknown>;
}

function mapAspectRatioToImageSize(aspectRatio: string | undefined, fallback: string): string {
  if (!aspectRatio) {
    return fallback;
  }

  const map: Record<string, string> = {
    "1:1": "square_hd",
    "4:3": "landscape_4_3",
    "3:4": "portrait_4_3",
    "16:9": "landscape_16_9",
    "9:16": "portrait_16_9",
    "3:2": "landscape_3_2",
    "2:3": "portrait_3_2",
  };

  return map[aspectRatio] || fallback;
}

function normalizeQuality(quality: string | undefined): string | undefined {
  if (!quality) {
    return undefined;
  }
  return quality.trim().toUpperCase();
}

function mapResolutionFromQuality(quality: string | undefined): string | undefined {
  switch (normalizeQuality(quality)) {
    case "STANDARD":
      return "1K";
    case "HIGH":
      return "2K";
    case "ULTRA":
      return "4K";
    default:
      return undefined;
  }
}

function mapRenderingSpeedFromQuality(quality: string | undefined): string | undefined {
  switch (normalizeQuality(quality)) {
    case "FAST":
      return "TURBO";
    case "BALANCED":
      return "BALANCED";
    case "HIGH":
      return "QUALITY";
    default:
      return undefined;
  }
}

// GPT Image 2.5 ships as two variants (Flare = fast/default, Sunburst =
// premium/polished) that share one request shape and one price. Kie exposes
// each as separate text-to-image / image-to-image model names, same as 2.0.
function gptImage25Config(
  variant: "flare" | "sunburst",
  label: string,
): ImageModelConfig {
  return {
    label,
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    taskIdField: "taskId",
    statusField: "status",
    successStates: ["success", "completed"],
    failStates: ["fail", "failed", "error"],
    imageUrlField: "url",
    costPerImage: 0.05,
    supportsImageInput: true,
    buildBody: (prompt, options) => {
      const hasImages = (options.imageUrls?.length ?? 0) > 0;
      return {
        model: hasImages
          ? `gpt-image-2-5-${variant}-image-to-image`
          : `gpt-image-2-5-${variant}-text-to-image`,
        input: {
          prompt,
          aspect_ratio: options.aspectRatio || "auto",
          resolution:
            mapResolutionFromQuality(options.quality) ||
            options.imageResolution ||
            "1K",
          ...(hasImages
            ? { input_urls: (options.imageUrls || []).slice(0, 16) }
            : {}),
        },
      };
    },
  };
}

function normalizeOutputFormat(outputFormat: string | undefined, fallback = "png"): string {
  if (!outputFormat) {
    return fallback;
  }
  const normalized = outputFormat.trim().toLowerCase();
  if (normalized === "jpg") {
    return "jpeg";
  }
  return normalized || fallback;
}

export const KIE_IMAGE_MODELS: Record<string, ImageModelConfig> = {
  "kie/4o-image": {
    label: "GPT-Image-1 (4o)",
    endpoint: "/api/v1/gpt4o-image/generate",
    statusEndpoint: "/api/v1/gpt4o-image/record-info",
    taskIdField: "taskId",
    statusField: "successFlag",
    successStates: [1, "1"],
    failStates: [2, "2"],
    imageUrlField: "result_urls",
    costPerImage: 0.03,
    supportsImageInput: true,
    // Kie's gpt4o-image endpoint silently clamps nVariants to 1 (the response's
    // paramJson echoes "nVariants":1 regardless of what we send), so batch is a
    // lie here. Marked false so the route rejects multi-variant requests at the
    // pre-flight rather than charging for variants users won't get.
    supportsBatchGeneration: false,
    buildBody: (prompt, options) => ({
      prompt,
      size: options.aspectRatio || "1:1",
      ...(options.imageUrls?.length && { filesUrl: options.imageUrls }),
    }),
  },
  "kie/nano-banana": {
    label: "Nano Banana",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    taskIdField: "taskId",
    statusField: "status",
    successStates: ["success", "completed"],
    failStates: ["fail", "failed", "error"],
    imageUrlField: "url",
    costPerImage: 0.04,
    supportsImageInput: false,
    buildBody: (prompt, options) => ({
      model: "google/nano-banana",
      input: {
        prompt,
        image_size: options.imageSize || options.aspectRatio || "1:1",
        output_format: normalizeOutputFormat(options.outputFormat, "png"),
      },
    }),
  },
  "kie/nano-banana-pro": {
    label: "Nano Banana Pro",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    taskIdField: "taskId",
    statusField: "status",
    successStates: ["success", "completed"],
    failStates: ["fail", "failed", "error"],
    imageUrlField: "url",
    costPerImage: 0.06,
    supportsImageInput: true,
    buildBody: (prompt, options) => ({
      model: "nano-banana-pro",
      input: {
        prompt,
        aspect_ratio: options.aspectRatio || "1:1",
        resolution:
          mapResolutionFromQuality(options.quality) || options.imageResolution || "1K",
        output_format: normalizeOutputFormat(options.outputFormat, "png"),
        image_input: options.imageUrls || [],
      },
    }),
  },
  "kie/nano-banana-2": {
    label: "Nano Banana 2",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    taskIdField: "taskId",
    statusField: "status",
    successStates: ["success", "completed"],
    failStates: ["fail", "failed", "error"],
    imageUrlField: "url",
    costPerImage: 0.04,
    supportsImageInput: true,
    buildBody: (prompt, options) => ({
      model: "nano-banana-2",
      input: {
        prompt,
        aspect_ratio: options.aspectRatio || "1:1",
        resolution:
          mapResolutionFromQuality(options.quality) || options.imageResolution || "1K",
        output_format: normalizeOutputFormat(options.outputFormat, "png"),
        image_input: options.imageUrls || [],
      },
    }),
  },
  "kie/flux-kontext": {
    label: "Flux Kontext Pro",
    endpoint: "/api/v1/flux/kontext/generate",
    statusEndpoint: "/api/v1/flux/kontext/record-info",
    taskIdField: "taskId",
    statusField: "successFlag",
    successStates: [1, "1"],
    failStates: [2, "2"],
    imageUrlField: "resultImageUrl",
    costPerImage: 0.05,
    supportsImageInput: true,
    buildBody: (prompt, options) => ({
      prompt,
      aspectRatio: options.aspectRatio || "1:1",
      outputFormat: "png",
      model: "flux-kontext-pro",
      ...(options.imageUrls?.[0] && { inputImage: options.imageUrls[0] }),
    }),
  },
  "kie/imagen-4": {
    label: "Google Imagen 4",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    taskIdField: "taskId",
    statusField: "status",
    successStates: ["success", "completed"],
    failStates: ["fail", "failed", "error"],
    imageUrlField: "url",
    costPerImage: 0.04,
    supportsImageInput: false,
    buildBody: (prompt, options) => ({
      model: "google/imagen4",
      input: { prompt, aspect_ratio: options.aspectRatio || "1:1" },
    }),
  },
  "kie/imagen-4-fast": {
    label: "Imagen 4 Fast",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    taskIdField: "taskId",
    statusField: "status",
    successStates: ["success", "completed"],
    failStates: ["fail", "failed", "error"],
    imageUrlField: "url",
    costPerImage: 0.02,
    supportsImageInput: false,
    supportsBatchGeneration: true,
    maxBatchCount: 4,
    buildBody: (prompt, options) => ({
      model: "google/imagen4-fast",
      input: {
        prompt,
        aspect_ratio: options.aspectRatio || "1:1",
        num_images: String(options.nVariants || 1),
      },
    }),
  },
  "kie/imagen-4-ultra": {
    label: "Imagen 4 Ultra",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    taskIdField: "taskId",
    statusField: "status",
    successStates: ["success", "completed"],
    failStates: ["fail", "failed", "error"],
    imageUrlField: "url",
    costPerImage: 0.08,
    supportsImageInput: false,
    buildBody: (prompt, options) => ({
      model: "google/imagen4-ultra",
      input: { prompt, aspect_ratio: options.aspectRatio || "1:1" },
    }),
  },
  "kie/flux-2": {
    label: "Flux-2 Pro",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    taskIdField: "taskId",
    statusField: "status",
    successStates: ["success", "completed"],
    failStates: ["fail", "failed", "error"],
    imageUrlField: "url",
    costPerImage: 0.03,
    supportsImageInput: false,
    buildBody: (prompt, options) => ({
      model: "flux-2/pro-text-to-image",
      input: {
        prompt,
        aspect_ratio: options.aspectRatio || "1:1",
        resolution: options.imageResolution || "2K",
      },
    }),
  },
  "kie/seedream-4": {
    label: "Seedream 4.0",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    taskIdField: "taskId",
    statusField: "status",
    successStates: ["success", "completed"],
    failStates: ["fail", "failed", "error"],
    imageUrlField: "url",
    costPerImage: 0.04,
    supportsImageInput: false,
    supportsBatchGeneration: true,
    maxBatchCount: 6,
    buildBody: (prompt, options) => ({
      model: "bytedance/seedream-v4-text-to-image",
      input: {
        prompt,
        image_size: mapAspectRatioToImageSize(options.aspectRatio, options.imageSize || "square_hd"),
        image_resolution:
          mapResolutionFromQuality(options.quality) || options.imageResolution || "1K",
        max_images: options.nVariants || 1,
      },
    }),
  },
  "kie/qwen": {
    label: "Qwen",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    taskIdField: "taskId",
    statusField: "status",
    successStates: ["success", "completed"],
    failStates: ["fail", "failed", "error"],
    imageUrlField: "url",
    costPerImage: 0.03,
    supportsImageInput: true,
    buildBody: (prompt, options) => {
      const isImageToImage = Boolean(options.imageUrls?.[0]);
      return {
        model: isImageToImage ? "qwen/image-to-image" : "qwen/text-to-image",
        input: {
          prompt,
          output_format: normalizeOutputFormat(options.outputFormat, "png"),
          ...(isImageToImage
            ? { image_url: options.imageUrls?.[0] }
            : {
                image_size: mapAspectRatioToImageSize(
                  options.aspectRatio,
                  options.imageSize || "square_hd"
                ),
              }),
        },
      };
    },
  },
  "kie/ideogram": {
    label: "Ideogram",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    taskIdField: "taskId",
    statusField: "status",
    successStates: ["success", "completed"],
    failStates: ["fail", "failed", "error"],
    imageUrlField: "url",
    costPerImage: 0.05,
    supportsImageInput: true,
    supportsBatchGeneration: true,
    maxBatchCount: 4,
    buildBody: (prompt, options) => ({
      model: "ideogram/character",
      input: {
        prompt,
        reference_image_urls: options.imageUrls || [],
        image_size: mapAspectRatioToImageSize(options.aspectRatio, options.imageSize || "square_hd"),
        num_images: String(options.nVariants || 1),
        rendering_speed:
          mapRenderingSpeedFromQuality(options.quality) || options.renderingSpeed || "BALANCED",
        style: options.style || "AUTO",
        expand_prompt: true,
        negative_prompt: "",
      },
    }),
  },
  "kie/grok-imagine": {
    label: "Grok Imagine",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    taskIdField: "taskId",
    statusField: "status",
    successStates: ["success", "completed"],
    failStates: ["fail", "failed", "error"],
    imageUrlField: "url",
    costPerImage: 0.04,
    supportsImageInput: true,
    buildBody: (prompt, options) => ({
      model: options.imageUrls?.length
        ? "grok-imagine/image-to-image"
        : "grok-imagine/text-to-image",
      input: {
        prompt,
        aspect_ratio: options.aspectRatio || "1:1",
        ...(options.imageUrls?.length && { image_urls: options.imageUrls }),
      },
    }),
  },
  "kie/z-image": {
    label: "Z-Image",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    taskIdField: "taskId",
    statusField: "status",
    successStates: ["success", "completed"],
    failStates: ["fail", "failed", "error"],
    imageUrlField: "url",
    costPerImage: 0.004,
    supportsImageInput: false,
    buildBody: (prompt, options) => ({
      model: "z-image",
      input: { prompt, aspect_ratio: options.aspectRatio || "1:1" },
    }),
  },
  "kie/gpt-image-2": {
    label: "GPT Image 2",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    taskIdField: "taskId",
    statusField: "status",
    successStates: ["success", "completed"],
    failStates: ["fail", "failed", "error"],
    imageUrlField: "url",
    costPerImage: 0.05,
    supportsImageInput: true,
    // Kie exposes two distinct model names for GPT Image 2: text-to-image
    // and image-to-image. Switch based on whether the user connected any
    // image nodes. Image-to-image takes up to 16 input_urls.
    buildBody: (prompt, options) => {
      const hasImages = (options.imageUrls?.length ?? 0) > 0;
      return {
        model: hasImages
          ? "gpt-image-2-image-to-image"
          : "gpt-image-2-text-to-image",
        input: {
          prompt,
          aspect_ratio: options.aspectRatio || "auto",
          resolution:
            mapResolutionFromQuality(options.quality) ||
            options.imageResolution ||
            "1K",
          ...(hasImages
            ? { input_urls: (options.imageUrls || []).slice(0, 16) }
            : {}),
        },
      };
    },
  },
  "kie/gpt-image-2-5-flare": gptImage25Config("flare", "GPT Image 2.5 Flare"),
  "kie/gpt-image-2-5-sunburst": gptImage25Config(
    "sunburst",
    "GPT Image 2.5 Sunburst",
  ),
};
