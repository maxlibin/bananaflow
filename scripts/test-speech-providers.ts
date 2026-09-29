import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_FORMATS, BufferSource, Input } from "mediabunny";

import { googleProvider } from "../src/lib/providers/google.ts";
import { openaiProvider } from "../src/lib/providers/openai.ts";
import { GOOGLE_SPEECH_MODELS, OPENAI_SPEECH_MODELS } from "../src/lib/model-registry.ts";

async function seconds(bytes: Buffer): Promise<number> {
  return new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS }).computeDuration();
}

const cases = [
  { name: "OpenAI", provider: openaiProvider, info: OPENAI_SPEECH_MODELS["openai/gpt-4o-mini-tts"], key: process.env.OPENAI_API_KEY, voiceId: "coral" },
  { name: "Gemini", provider: googleProvider, info: GOOGLE_SPEECH_MODELS["google/gemini-3.8-flash-lite-tts"], key: process.env.GOOGLE_API_KEY, voiceId: "Kore" },
];

for (const c of cases) {
  test(`${c.name} speaks one line as a playable audio file`, { skip: c.key ? false : `no ${c.name} key in .env` }, async () => {
    const result = await c.provider.createSpeech({
      model: "m",
      providerModel: c.info.providerModel,
      text: "Meet the banana phone stand.",
      voiceId: c.voiceId,
      secret: c.key as string,
    });
    assert.ok(result.bytes.byteLength > 1000);
    const length = await seconds(result.bytes);
    assert.ok(length > 0.5 && length < 10, `length ${length}s`);
  });
}

test("an unknown voice is refused with the provider's message", { skip: process.env.OPENAI_API_KEY ? false : "no OpenAI key" }, async () => {
  await assert.rejects(
    openaiProvider.createSpeech({ model: "m", providerModel: "gpt-4o-mini-tts", text: "Hi", voiceId: "not-a-voice", secret: process.env.OPENAI_API_KEY as string }),
    /OpenAI speech failed \(400\)/,
  );
});
