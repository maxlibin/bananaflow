import type { ProviderId } from "../../lib/providers/types";

// Providers the open-source app talks to directly, in preference order.
// The first one supplies the editing model for upscale, background removal
// and face consistency.
export const LOCAL_ENABLED_PROVIDERS: ProviderId[] = ["google", "openai"];
