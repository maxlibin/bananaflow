import { host } from "../../../host";
import { createGenerateImageRoute } from "../../../lib/routes/generate-image";

export const maxDuration = 60;

export const { POST } = createGenerateImageRoute(host);
