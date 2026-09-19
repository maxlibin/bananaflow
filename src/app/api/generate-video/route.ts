import { host } from "../../../host";
import { createGenerateVideoRoute } from "../../../lib/routes/generate-video";

export const maxDuration = 60;

export const { POST } = createGenerateVideoRoute(host);
