// String union mirrored by the SaaS `UsageFeature` enum values. The canvas
// and engine use these strings; the SaaS host casts them to its enum.
export type GenerationFeature =
  | "IMAGE_GENERATION"
  | "VIDEO_GENERATION"
  | "STORAGE_BYTES"
  | "IMAGE_UPSCALE"
  | "BACKGROUND_REMOVAL"
  | "FACE_CONSISTENCY"
  | "BOARD_CREATED";
