import { host } from "../../../host";
import { createGenerateSpeechRoute } from "../../../lib/routes/generate-speech";

export const { POST } = createGenerateSpeechRoute(host);
