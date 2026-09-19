// Resolves a raw model key (e.g. "openai/gpt-image-1") to the user-facing
// label. Model keys carry a provider prefix that is an implementation detail;
// surfacing it in history captions leaks routing decisions to users.

import type { CanvasModels } from "./model-options";

export function getModelLabel(models: CanvasModels, key: string | null | undefined): string {
  if (!key) return "—";

  const video = models.video.find((model) => model.value === key);
  if (video) return video.label;
  const image = models.image.find((model) => model.value === key);
  if (image) return image.label;

  // Fallback: strip the provider prefix and prettify the suffix.
  const stripped = key.replace(/^[a-z]+\//i, "");
  return stripped
    .split("-")
    .map((segment) =>
      /^\d/.test(segment) ? segment : segment.charAt(0).toUpperCase() + segment.slice(1),
    )
    .join(" ");
}
