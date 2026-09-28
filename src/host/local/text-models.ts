import type { TextModelOption } from "../../lib/model-options";

// Script-writing models, called with the user's own provider key. Ids are
// "<provider>/<model>" so the key lookup knows which provider to use.
export const LOCAL_TEXT_MODELS: TextModelOption[] = [
  { id: "openai/gpt-5.6-terra", label: "GPT-5.6 Terra", description: "balanced · OpenAI key" },
  { id: "openai/gpt-5.6-sol", label: "GPT-5.6 Sol", description: "best writing · OpenAI key" },
  { id: "openai/gpt-5.6-luna", label: "GPT-5.6 Luna", description: "fastest · OpenAI key" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", description: "Google key" },
  { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash", description: "fast · Google key" },
];

export const LOCAL_DEFAULT_TEXT_MODEL = "openai/gpt-5.6-terra";
export const LOCAL_FAST_TEXT_MODEL = "openai/gpt-5.6-luna";
