import { host } from "../../../../host";
import { createImageJobRoute } from "../../../../lib/routes/image-job";

export const { GET, DELETE } = createImageJobRoute(host);
