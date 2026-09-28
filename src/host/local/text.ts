import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { HostAdapter } from "../../lib/host/types";
import {
  LOCAL_DEFAULT_TEXT_MODEL,
  LOCAL_FAST_TEXT_MODEL,
  LOCAL_TEXT_MODELS,
} from "./text-models";

export function createLocalText(keys: HostAdapter["keys"]): HostAdapter["text"] {
  return {
    models: LOCAL_TEXT_MODELS,
    defaultModelId: LOCAL_DEFAULT_TEXT_MODEL,
    fastModelId: LOCAL_FAST_TEXT_MODEL,
    async languageModel(userId, modelId) {
      const separator = modelId.indexOf("/");
      const provider = modelId.slice(0, separator);
      const name = modelId.slice(separator + 1);
      if (provider === "openai") {
        return createOpenAI({ apiKey: await keys.resolveProviderKey(userId, "openai") })(name);
      }
      if (provider === "google") {
        return createGoogleGenerativeAI({
          apiKey: await keys.resolveProviderKey(userId, "google"),
        })(name);
      }
      throw new Error(`Text model "${modelId}" has no provider this host can call`);
    },
  };
}
