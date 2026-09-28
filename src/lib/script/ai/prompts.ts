import type {
  EntityDraft,
  ScriptBrief,
  ScriptConcept,
} from "../assistant";
import { getStoryStructure } from "../structures";
import { SPOKEN_WORDS_PER_SECOND } from "../timing";

export const SCREENWRITER_SYSTEM = [
  "You are an award-winning short-form video screenwriter and director. You write scripts that are produced entirely with AI video models (Veo, Kling, Seedance, Sora), so every scene must be something those models can render well.",
  "",
  "Principles you never break:",
  "- The first 2 seconds must stop the scroll: a striking image, a pattern interrupt, a bold claim or a question the viewer needs answered.",
  "- Show, don't tell. Every scene has a concrete, filmable visual: who/what is on screen, what they do, where, what the light feels like.",
  "- One idea per scene. Cut anything the viewer would not miss.",
  `- Spoken words (voiceover + dialogue) fit the time: at most ${SPOKEN_WORDS_PER_SECOND} words per second of the scene.`,
  "- Write for AI video: few characters, simple physical actions, no tiny readable text inside the image, no complex hand-object manipulation, no crowds doing coordinated things, no rapid cuts inside one scene. Describe people and products the same way every time they appear.",
  "- Specific beats generic: 'steam curling off a chipped blue mug at 6am' beats 'a nice morning'.",
  "- End with one clear, motivated call to action when the goal calls for it.",
  "- Match the language of the brief.",
].join("\n");

function briefBlock(brief: ScriptBrief): string {
  const structure = getStoryStructure(brief.structureId);
  return [
    `Product / subject: ${brief.product}`,
    `Audience: ${brief.audience}`,
    `Goal: ${brief.goal || "not specified"}`,
    `Tone: ${brief.tone || "not specified"}`,
    `Platform: ${brief.platform}`,
    `Target length: ${brief.targetDuration} seconds`,
    `Story structure: ${structure.label} (${structure.description})`,
    brief.notes ? `Extra notes: ${brief.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function conceptsPrompt(brief: ScriptBrief): string {
  return [
    "Pitch exactly 3 distinct creative directions for this video. Make them genuinely different: e.g. one emotional/story-led, one unexpected or funny, one proof/demo-led. Each needs a short title, a one-sentence logline, the angle (why it will work for this audience) and the exact opening hook line or image.",
    "",
    briefBlock(brief),
  ].join("\n");
}

export function writeScriptPrompt(brief: ScriptBrief, concept: ScriptConcept): string {
  const structure = getStoryStructure(brief.structureId);
  const sections = structure.sections
    .map(
      (section) =>
        `- ${section.heading} (~${Math.max(1, Math.round(section.share * brief.targetDuration))}s): ${section.guidance}`,
    )
    .join("\n");
  return [
    "Write the full script for this direction.",
    "",
    briefBlock(brief),
    "",
    `Chosen direction: ${concept.title}`,
    `Logline: ${concept.logline}`,
    `Angle: ${concept.angle}`,
    `Hook: ${concept.hook}`,
    "",
    "Follow this structure, one or more scenes per section, in order:",
    sections,
    "",
    "Rules for the output:",
    `- Scene seconds must add up to about ${brief.targetDuration}.`,
    "- Every scene has at least one 'action' line describing exactly what the camera sees.",
    "- Use 'voiceover' for narration, 'dialogue' (with the character name) for on-camera speech, 'onscreen' for short text overlays.",
    `- Voiceover + dialogue words in a scene <= ${SPOKEN_WORDS_PER_SECOND} x its seconds.`,
    "- Scene headings are short labels like 'Hook: the cracked screen'.",
  ].join("\n");
}

export function editSelectionPrompt(input: {
  instruction: string;
  selectedText: string;
  scriptText: string;
}): string {
  return [
    `Rewrite the SELECTED TEXT following this instruction: ${input.instruction}`,
    "Return only the replacement text, with no quotes, labels or commentary. Keep it roughly the same length unless the instruction says otherwise, keep the same language, and keep it consistent with the rest of the script.",
    "",
    "FULL SCRIPT (for context):",
    input.scriptText,
    "",
    "SELECTED TEXT:",
    input.selectedText,
  ].join("\n");
}

export function alternativeHooksPrompt(input: {
  scriptText: string;
  currentHook: string;
  count: number;
}): string {
  return [
    `Write ${input.count} alternative opening hooks for this script. Each must work in the first 2 seconds and use a different technique: provocative question, bold claim, pattern interrupt visual, relatable POV, surprising fact, or in-media-res moment. Describe the image and the line together in one sentence each. Stay true to the product and tone.`,
    "",
    `Current hook: ${input.currentHook}`,
    "",
    "SCRIPT:",
    input.scriptText,
  ].join("\n");
}

export function critiquePrompt(input: {
  scriptText: string;
  targetDuration: number;
  platform: string;
}): string {
  return [
    `Critique this ${input.targetDuration}-second ${input.platform} script like a tough creative director. Score each dimension 1-10 (10 is exceptional; most first drafts are 5-7) with a one-sentence note:`,
    "- hook: does it stop the scroll in 2 seconds?",
    "- clarity: is the message instantly understood?",
    `- pacing: does it fit ${input.targetDuration}s without rushed voiceover or dead air?`,
    "- visualFeasibility: can current AI video models render every scene convincingly?",
    "- callToAction: is the ending motivated and clear?",
    "Then list the 3-5 highest-impact fixes, each tied to a scene heading (or null for the whole script), stating the issue and a concrete rewrite suggestion.",
    "",
    "SCRIPT:",
    input.scriptText,
  ].join("\n");
}

export function extractEntitiesPrompt(input: { scriptText: string }): string {
  return [
    "List the recurring characters, products and locations in this script that must look the same in every shot they appear in.",
    "",
    "Rules:",
    "- Include every named or clearly recurring person (character), the advertised product and any branded object (product), and any setting used in 2+ scenes (location). Skip one-off background extras and generic props.",
    "- 'name' is a short unique label as the script refers to it (e.g. 'MAYA', 'BREWLY BOTTLE', 'HOME OFFICE').",
    "- 'look' is one dense visual description an image model can reproduce exactly: for people age range, build, hair, skin tone, wardrobe; for products shape, size, colors, materials, label; for locations layout, materials, light. Invent consistent specifics where the script is vague, never contradict it.",
    "",
    "SCRIPT:",
    input.scriptText,
  ].join("\n");
}

export function breakIntoShotsPrompt(input: {
  scenes: Array<{ sceneId: string; text: string; seconds: number }>;
  entities: EntityDraft[];
  aspectRatio: string;
  shotSeconds: { min: number; max: number };
}): string {
  const scenes = input.scenes
    .map((scene) => `[sceneId: ${scene.sceneId}] (${scene.seconds}s)\n${scene.text}`)
    .join("\n\n");
  return [
    `Break these scenes into shots for AI video generation (aspect ratio ${input.aspectRatio}).`,
    "",
    "Rules:",
    `- The video model makes clips of ${input.shotSeconds.min}-${input.shotSeconds.max} whole seconds. Every shot duration must be a whole number in that range.`,
    `- Use ONE shot per scene. Only split a scene into 2-3 shots when it is longer than ${input.shotSeconds.max}s or truly needs a new camera angle, and never create a shot shorter than ${input.shotSeconds.min}s. A scene shorter than ${input.shotSeconds.min}s becomes one ${input.shotSeconds.min}s shot.`,
    "- Number shots per scene starting at 1 ('order'), and copy the scene's sceneId exactly.",
    "- Each shot is generated independently, so 'action' must fully describe who and what is on screen every time (appearance, clothing, product look) and what physically happens. One camera move per shot.",
    "- 'setting' describes the location and light. 'style' is one consistent visual style string reused for every shot (film look, color grade, lens feel).",
    "- Put spoken lines in 'dialogue' (character + line) or 'voiceover'; split long lines across shots so each shot's speech fits its duration.",
    "- 'onScreenText' only when the script has on-screen text for that moment, else empty.",
    "- 'entities' lists the exact names of the cast and props below that are visible in the shot (empty if none). In 'action', describe each of them exactly as their look says.",
    "",
    "CAST AND PROPS:",
    input.entities.length > 0
      ? input.entities.map((entity) => `- ${entity.name} (${entity.kind}): ${entity.look}`).join("\n")
      : "(none)",
    "",
    scenes,
  ].join("\n");
}
