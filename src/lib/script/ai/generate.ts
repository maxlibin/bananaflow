import { generateText, Output } from "ai";
import type { z } from "zod";
import type { Denial, HostAdapter } from "../../host/types";
import { SCREENWRITER_SYSTEM } from "./prompts";

// Server action errors are redacted in production, so failures come back as
// values; `denial` carries a host limit (credits, rate limit) for the limit UI.
export type ScriptActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; denial: Denial | null };

const CHARS_PER_TOKEN = 4;

// Policy check, structured generation with the screenwriter instructions,
// then the usage report.
export async function generateScriptObject<T>(
  host: HostAdapter,
  input: {
    userId: string;
    task: string;
    modelId: string;
    prompt: string;
    schema: z.ZodType<T>;
    maxOutputTokens: number;
  },
): Promise<ScriptActionResult<T>> {
  const decision = await host.policy.beforeText({
    userId: input.userId,
    task: input.task,
    model: input.modelId,
    estimatedInputTokens: Math.ceil(
      (SCREENWRITER_SYSTEM.length + input.prompt.length) / CHARS_PER_TOKEN,
    ),
    maxOutputTokens: input.maxOutputTokens,
  });
  if (!decision.ok) {
    return { ok: false, error: decision.message, denial: decision };
  }

  let generated: { output: T; inputTokens: number; outputTokens: number };
  try {
    const { output, usage } = await generateText({
      model: await host.text.languageModel(input.userId, input.modelId),
      instructions: SCREENWRITER_SYSTEM,
      prompt: input.prompt,
      maxOutputTokens: input.maxOutputTokens,
      output: Output.object({ schema: input.schema }),
    });
    generated = {
      output,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    };
  } catch (error) {
    console.error("Script writing request failed", {
      task: input.task,
      model: input.modelId,
      userId: input.userId,
      error,
    });
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: `The AI could not finish this request (${input.modelId}): ${reason}`,
      denial: null,
    };
  }

  await host.policy.afterText({
    userId: input.userId,
    task: input.task,
    model: input.modelId,
    inputTokens: generated.inputTokens,
    outputTokens: generated.outputTokens,
  });
  return { ok: true, value: generated.output };
}
