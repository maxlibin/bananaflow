export const VARIATION_CAPS = {
  image: 6,
  video: 2,
} as const;

export function clampVariantCount(
  kind: "image" | "video",
  variants: number,
): number {
  const cap = VARIATION_CAPS[kind];
  return Math.min(Math.max(1, Math.floor(variants)), cap);
}
