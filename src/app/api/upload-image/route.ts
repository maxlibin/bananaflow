import { host } from "../../../host";
import { createUploadImageRoute } from "../../../lib/routes/upload-image";

export const maxDuration = 300;

export const { POST, DELETE } = createUploadImageRoute(host);
