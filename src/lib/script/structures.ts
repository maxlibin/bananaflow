import {
  SCRIPT_BLOCK_TYPES,
  type ScriptDoc,
  type StructureId,
} from "./types";

export type StructureSection = {
  heading: string;
  // Fraction of the target duration this section should take.
  share: number;
  guidance: string;
};

export type StoryStructure = {
  id: StructureId;
  label: string;
  description: string;
  sections: StructureSection[];
};

export const STORY_STRUCTURES: StoryStructure[] = [
  {
    id: "hook-problem-solution-cta",
    label: "Hook → Problem → Solution → CTA",
    description: "The classic short-form ad. Stop the scroll, name the pain, show the fix, ask for the action.",
    sections: [
      { heading: "Hook", share: 0.15, guidance: "A visual or line that stops the scroll in the first 2-3 seconds. Pattern interrupt, bold claim or question." },
      { heading: "Problem", share: 0.25, guidance: "Show the frustration the audience already feels. Specific and visual, not abstract." },
      { heading: "Solution", share: 0.4, guidance: "The product solving that exact problem on screen. Show, don't list features." },
      { heading: "CTA", share: 0.2, guidance: "One clear action and a reason to do it now." },
    ],
  },
  {
    id: "ugc-testimonial",
    label: "UGC testimonial",
    description: "A real-feeling person talking to camera about their experience.",
    sections: [
      { heading: "Hook", share: 0.15, guidance: "Creator speaks straight to camera with a surprising first line." },
      { heading: "Before", share: 0.25, guidance: "What life was like before, told as a quick personal story." },
      { heading: "Discovery", share: 0.3, guidance: "How they found the product and the moment it clicked, with it in hand." },
      { heading: "Result + CTA", share: 0.3, guidance: "The concrete result and a casual recommendation." },
    ],
  },
  {
    id: "product-demo",
    label: "Product demo",
    description: "Walk through the product's key moments with clear visual beats.",
    sections: [
      { heading: "Hero reveal", share: 0.2, guidance: "The product at its most striking, one clean camera move." },
      { heading: "Feature 1", share: 0.25, guidance: "The most important benefit, demonstrated in use." },
      { heading: "Feature 2", share: 0.25, guidance: "A second benefit, visually distinct from the first." },
      { heading: "Close + CTA", share: 0.3, guidance: "Product with brand and a single call to action." },
    ],
  },
  {
    id: "before-after",
    label: "Before / After",
    description: "Contrast a painful before with a transformed after.",
    sections: [
      { heading: "Before", share: 0.35, guidance: "The messy, frustrating state. Same framing you will reuse for After." },
      { heading: "Transformation", share: 0.2, guidance: "The product entering the scene; a satisfying transition." },
      { heading: "After", share: 0.3, guidance: "The same setup, visibly transformed." },
      { heading: "CTA", share: 0.15, guidance: "Short line and brand." },
    ],
  },
  {
    id: "three-act-story",
    label: "3-act mini story",
    description: "A tiny narrative with a character, a conflict and a payoff.",
    sections: [
      { heading: "Setup", share: 0.25, guidance: "Introduce the character and what they want in one image." },
      { heading: "Conflict", share: 0.4, guidance: "Something stands in the way; raise the stakes visually." },
      { heading: "Resolution", share: 0.35, guidance: "The payoff, ideally with a twist or emotional beat." },
    ],
  },
];

export function getStoryStructure(id: StructureId): StoryStructure {
  const structure = STORY_STRUCTURES.find((item) => item.id === id);
  if (!structure) {
    throw new Error(`Unknown story structure "${id}"`);
  }
  return structure;
}

// Rounds each section's share of the total on a running sum, so the whole
// seconds always add up to the target (plain per-section rounding drifts).
export function allocateSeconds(shares: number[], total: number): number[] {
  let assigned = 0;
  let cumulativeShare = 0;
  return shares.map((share) => {
    cumulativeShare += share;
    const next = Math.round(cumulativeShare * total);
    const seconds = next - assigned;
    assigned = next;
    return seconds;
  });
}

export function buildStructureSkeleton(input: {
  structureId: StructureId;
  targetDuration: number;
  createSceneId: () => string;
}): ScriptDoc {
  const structure = getStoryStructure(input.structureId);
  const seconds = allocateSeconds(
    structure.sections.map((section) => section.share),
    input.targetDuration,
  );
  return structure.sections.flatMap((section, index) => [
    {
      type: SCRIPT_BLOCK_TYPES.scene,
      sceneId: input.createSceneId(),
      seconds: seconds[index],
      children: [{ text: section.heading }],
    },
    {
      type: SCRIPT_BLOCK_TYPES.action,
      children: [{ text: "" }],
    },
  ]);
}
