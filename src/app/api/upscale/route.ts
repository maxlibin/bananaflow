import { host } from "../../../host";
import { createUpscaleRoute } from "../../../lib/routes/advanced-ops";

export const maxDuration = 300;

export const { POST } = createUpscaleRoute(host);
