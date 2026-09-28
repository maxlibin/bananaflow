import { z } from "zod";
import { LENS_PRESET_IDS } from "../../direction/presets";
import {
  ENTITY_KINDS,
  SHOT_CAMERA_MOVES,
  SHOT_FRAMINGS,
} from "../types";

export const conceptsSchema = z.object({
  concepts: z
    .array(
      z.object({
        title: z.string(),
        logline: z.string(),
        angle: z.string(),
        hook: z.string(),
      }),
    )
    .length(3),
});

export const draftSchema = z.object({
  title: z.string(),
  logline: z.string(),
  scenes: z
    .array(
      z.object({
        heading: z.string(),
        seconds: z.number().positive(),
        lines: z.array(
          z.object({
            kind: z.enum(["action", "voiceover", "dialogue", "onscreen"]),
            text: z.string(),
            character: z
              .string()
              .nullable()
              .describe("Speaker name for dialogue lines, null otherwise."),
          }),
        ),
      }),
    )
    .min(1),
});

export const replacementSchema = z.object({
  replacement: z.string(),
});

export const hooksSchema = z.object({
  hooks: z.array(z.string()).min(1),
});

const scoreSchema = z.object({
  score: z.number().int().min(1).max(10),
  note: z.string(),
});

export const critiqueSchema = z.object({
  overall: z.number().int().min(1).max(10),
  hook: scoreSchema,
  clarity: scoreSchema,
  pacing: scoreSchema,
  visualFeasibility: scoreSchema,
  callToAction: scoreSchema,
  fixes: z.array(
    z.object({
      sceneHeading: z.string().nullable(),
      issue: z.string(),
      suggestion: z.string(),
    }),
  ),
});

export const shotsSchema = z.object({
  shots: z
    .array(
      z.object({
        sceneId: z.string(),
        order: z.number().int().min(1),
        duration: z.number().int().positive(),
        framing: z.enum(SHOT_FRAMINGS),
        cameraMove: z.enum(SHOT_CAMERA_MOVES),
        lens: z.enum(LENS_PRESET_IDS).nullable(),
        action: z.string(),
        setting: z.string(),
        style: z.string(),
        dialogue: z.array(z.object({ character: z.string(), line: z.string() })),
        voiceover: z.string(),
        onScreenText: z.string(),
        entities: z.array(z.string()),
      }),
    )
    .min(1),
});

export const entitiesSchema = z.object({
  entities: z.array(
    z.object({
      kind: z.enum(ENTITY_KINDS),
      name: z.string(),
      look: z.string(),
    }),
  ),
});
