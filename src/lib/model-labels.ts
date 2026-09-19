// Resolves a raw model key (e.g. "kie/runway") to the user-facing label
// (e.g. "Runway Gen-3").
//
// Why: model keys carry a provider prefix that's an internal implementation
// detail (`kie/...` for the Kie aggregator). Surfacing those prefixes in
// History panel / Bulk run captions leaks our routing decisions to users.
// This helper hides them.

import { IMAGE_MODELS, VIDEO_MODELS } from "./model-registry";

export function getModelLabel(key: string | null | undefined): string {
  if (!key) return "—";

  const videoCfg = VIDEO_MODELS[key];
  if (videoCfg?.label) return videoCfg.label;

  const imageCfg = IMAGE_MODELS[key];
  if (imageCfg?.label) return imageCfg.label;

  // Fallback: strip provider prefix and prettify the suffix so we never
  // expose "kie/" even if a key isn't registered.
  const stripped = key.replace(/^[a-z]+\//i, "");
  return stripped
    .split("-")
    .map((segment) =>
      /^\d/.test(segment) ? segment : segment.charAt(0).toUpperCase() + segment.slice(1),
    )
    .join(" ");
}
