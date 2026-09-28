// Cinematography presets: pick a look instead of describing it. Each preset
// carries the phrase compiled into image/video prompts. Camera ids include the
// original nine shot camera moves so shots saved before presets still resolve.

export type DirectionCategory = "camera" | "lens" | "look" | "lighting";

export type DirectionPreset = {
  id: string;
  category: DirectionCategory;
  label: string;
  description: string;
  prompt: string;
};

export const CAMERA_PRESETS = [
  { id: "static", label: "Static", description: "Locked-off tripod shot; the scene moves, the camera doesn't.", prompt: "static locked-off camera on a tripod" },
  { id: "push-in", label: "Push in", description: "Slow move toward the subject to build intimacy or tension.", prompt: "slow dolly push-in toward the subject" },
  { id: "pull-out", label: "Pull out", description: "Slow move away, revealing context or isolation.", prompt: "slow dolly pull-out revealing the surroundings" },
  { id: "pan", label: "Pan", description: "Camera turns horizontally to follow or reveal.", prompt: "smooth horizontal pan" },
  { id: "tilt", label: "Tilt", description: "Camera tilts up or down to reveal scale.", prompt: "smooth vertical tilt revealing the subject" },
  { id: "tracking", label: "Tracking", description: "Camera travels alongside a moving subject.", prompt: "tracking shot moving alongside the subject at their pace" },
  { id: "orbit", label: "Orbit", description: "Camera circles the subject for a hero moment.", prompt: "camera orbiting slowly around the subject" },
  { id: "handheld", label: "Handheld", description: "Natural shake for documentary or UGC realism.", prompt: "handheld camera with subtle natural shake" },
  { id: "crane", label: "Crane up", description: "Camera rises high above the scene.", prompt: "crane shot rising up and over the scene" },
  { id: "dolly-zoom", label: "Dolly zoom", description: "Vertigo effect: background warps while the subject holds size.", prompt: "dolly zoom vertigo effect, the background stretches while the subject stays the same size" },
  { id: "crash-zoom", label: "Crash zoom", description: "Fast punch-in for comedy or shock.", prompt: "sudden fast crash zoom onto the subject" },
  { id: "whip-pan", label: "Whip pan", description: "Blurred fast pan, great as a transition.", prompt: "fast whip pan with motion blur" },
  { id: "bullet-time", label: "Bullet time", description: "Frozen moment while the camera sweeps around it.", prompt: "bullet-time effect, the action frozen in slow motion as the camera sweeps around the subject" },
  { id: "fpv-drone", label: "FPV drone", description: "Fast swooping first-person drone flight.", prompt: "fast FPV drone flight swooping through the scene" },
  { id: "aerial", label: "Aerial", description: "High, slow drone establishing shot.", prompt: "slow aerial drone shot high above the location" },
  { id: "rack-focus", label: "Rack focus", description: "Focus shifts from foreground to background.", prompt: "rack focus shifting from the foreground to the background subject" },
  { id: "snorricam", label: "Body cam", description: "Camera locked to the subject's body; the world moves.", prompt: "body-mounted snorricam, the subject fixed in frame while the world moves around them" },
  { id: "top-down", label: "Top down", description: "Overhead bird's-eye view, ideal for products and food.", prompt: "overhead top-down bird's-eye camera" },
  { id: "low-angle", label: "Low angle", description: "Camera looks up to make the subject powerful.", prompt: "low-angle camera looking up at the subject" },
  { id: "dutch-angle", label: "Dutch angle", description: "Tilted horizon for unease or energy.", prompt: "tilted dutch-angle camera" },
] as const satisfies ReadonlyArray<Omit<DirectionPreset, "category">>;

export const LENS_PRESETS = [
  { id: "ultra-wide-14mm", label: "14mm ultra-wide", description: "Huge space, strong perspective, edge distortion.", prompt: "shot on a 14mm ultra-wide lens with dramatic perspective" },
  { id: "wide-24mm", label: "24mm wide", description: "Environmental storytelling, subject in context.", prompt: "shot on a 24mm wide lens" },
  { id: "natural-35mm", label: "35mm", description: "Natural documentary field of view.", prompt: "shot on a 35mm lens with a natural field of view" },
  { id: "standard-50mm", label: "50mm", description: "Close to human vision, clean and honest.", prompt: "shot on a 50mm lens" },
  { id: "portrait-85mm", label: "85mm portrait", description: "Flattering faces, creamy background blur.", prompt: "shot on an 85mm portrait lens at f/1.8 with creamy bokeh" },
  { id: "telephoto-135mm", label: "135mm telephoto", description: "Compressed background, subject isolated.", prompt: "shot on a 135mm telephoto lens with compressed background" },
  { id: "macro", label: "Macro", description: "Extreme detail on textures and small objects.", prompt: "macro lens extreme close detail with shallow depth of field" },
  { id: "anamorphic", label: "Anamorphic", description: "Widescreen cinema look with oval bokeh and flares.", prompt: "anamorphic lens with oval bokeh and horizontal lens flares" },
  { id: "fisheye", label: "Fisheye", description: "Bulging skate-video distortion.", prompt: "fisheye lens with strong barrel distortion" },
] as const satisfies ReadonlyArray<Omit<DirectionPreset, "category">>;

export const LOOK_PRESETS = [
  { id: "kodak-film", label: "Kodak film", description: "Warm Portra 400 tones with fine grain.", prompt: "shot on Kodak Portra 400 film, warm natural tones, fine film grain" },
  { id: "16mm-documentary", label: "16mm documentary", description: "Raw, grainy, intimate indie texture.", prompt: "16mm documentary film look, visible grain, slightly faded colors" },
  { id: "teal-orange", label: "Teal & orange", description: "Blockbuster contrast between skin and shadows.", prompt: "cinematic teal and orange color grade, high contrast" },
  { id: "noir", label: "Noir", description: "High-contrast black and white with deep shadows.", prompt: "black and white film noir, deep shadows, high contrast" },
  { id: "neon-night", label: "Neon night", description: "Wet streets, magenta and cyan glow.", prompt: "neon-lit night, magenta and cyan glow reflecting on wet surfaces" },
  { id: "golden-hour", label: "Golden hour", description: "Low sun, warm glow, long shadows.", prompt: "golden hour sunlight, warm glow and long soft shadows" },
  { id: "clean-product", label: "Clean product", description: "Bright, crisp, premium e-commerce look.", prompt: "clean bright premium product photography look, crisp detail, soft shadows" },
  { id: "soft-beauty", label: "Soft beauty", description: "Glowy skin, pastel, beauty-ad polish.", prompt: "soft glowing beauty commercial look, luminous skin, pastel tones" },
  { id: "pastel-symmetry", label: "Pastel symmetry", description: "Centered framing and candy pastel palette.", prompt: "perfectly symmetrical centered composition, candy pastel color palette" },
  { id: "bleach-bypass", label: "Bleach bypass", description: "Desaturated, gritty, metallic contrast.", prompt: "bleach bypass look, desaturated colors, gritty high contrast" },
  { id: "vhs-90s", label: "90s VHS", description: "Home-video nostalgia with scanlines.", prompt: "1990s VHS home video look, soft focus, color bleed and scanlines" },
  { id: "moody-drama", label: "Moody drama", description: "Muted palette, low key, prestige-TV feel.", prompt: "moody prestige drama look, muted desaturated palette, low-key lighting" },
  { id: "vibrant-pop", label: "Vibrant pop", description: "Saturated colors for energetic social ads.", prompt: "vibrant saturated pop colors, punchy contrast" },
  { id: "anime", label: "Anime", description: "Hand-painted Japanese animation style.", prompt: "hand-painted Japanese anime style" },
  { id: "claymation", label: "Claymation", description: "Stop-motion clay texture and charm.", prompt: "stop-motion claymation style with visible clay texture" },
  { id: "3d-render", label: "3D render", description: "Polished Pixar-like 3D animation.", prompt: "polished 3D animated render, soft global illumination" },
] as const satisfies ReadonlyArray<Omit<DirectionPreset, "category">>;

export const LIGHTING_PRESETS = [
  { id: "soft-window", label: "Soft window", description: "Diffused daylight from one side.", prompt: "soft diffused window light from the side" },
  { id: "hard-sun", label: "Hard sun", description: "Crisp midday sun with sharp shadows.", prompt: "hard direct sunlight with crisp shadows" },
  { id: "backlit-rim", label: "Backlit rim", description: "Glowing outline separates the subject.", prompt: "strong backlight creating a glowing rim light around the subject" },
  { id: "studio-three-point", label: "Studio", description: "Even, controlled three-point lighting.", prompt: "controlled three-point studio lighting" },
  { id: "practical-neon", label: "Practical neon", description: "Colored light from signs in the scene.", prompt: "lit by colored neon practical lights in the scene" },
  { id: "candlelight", label: "Candlelight", description: "Warm flickering low light.", prompt: "warm flickering candlelight" },
  { id: "overcast", label: "Overcast", description: "Flat, soft, shadowless daylight.", prompt: "soft overcast daylight with no hard shadows" },
  { id: "silhouette", label: "Silhouette", description: "Subject dark against a bright background.", prompt: "subject in silhouette against a bright background" },
] as const satisfies ReadonlyArray<Omit<DirectionPreset, "category">>;

export type CameraPresetId = (typeof CAMERA_PRESETS)[number]["id"];
export type LensPresetId = (typeof LENS_PRESETS)[number]["id"];
export type LookPresetId = (typeof LOOK_PRESETS)[number]["id"];
export type LightingPresetId = (typeof LIGHTING_PRESETS)[number]["id"];

export const CAMERA_PRESET_IDS = CAMERA_PRESETS.map((preset) => preset.id) as [
  CameraPresetId,
  ...CameraPresetId[],
];
export const LENS_PRESET_IDS = LENS_PRESETS.map((preset) => preset.id) as [
  LensPresetId,
  ...LensPresetId[],
];
export const LOOK_PRESET_IDS = LOOK_PRESETS.map((preset) => preset.id) as [
  LookPresetId,
  ...LookPresetId[],
];
export const LIGHTING_PRESET_IDS = LIGHTING_PRESETS.map((preset) => preset.id) as [
  LightingPresetId,
  ...LightingPresetId[],
];

export const DIRECTION_PRESETS: DirectionPreset[] = [
  ...CAMERA_PRESETS.map((preset) => ({ ...preset, category: "camera" as const })),
  ...LENS_PRESETS.map((preset) => ({ ...preset, category: "lens" as const })),
  ...LOOK_PRESETS.map((preset) => ({ ...preset, category: "look" as const })),
  ...LIGHTING_PRESETS.map((preset) => ({ ...preset, category: "lighting" as const })),
];

export function getDirectionPreset(category: DirectionCategory, id: string): DirectionPreset {
  const preset = DIRECTION_PRESETS.find((item) => item.category === category && item.id === id);
  if (!preset) {
    throw new Error(`Unknown ${category} preset "${id}"`);
  }
  return preset;
}

// Media a host can attach to presets so the picker shows what each one looks
// like: a short clip for camera moves, a still for lenses, looks and lighting.
export type DirectionSample = { videoUrl: string | null; imageUrl: string | null };
export type DirectionSamples = Record<string, DirectionSample>;

export function directionSampleKey(category: DirectionCategory, id: string): string {
  return `${category}:${id}`;
}
