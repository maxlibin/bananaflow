import { host } from "../../../../host";
import { createVideoJobRoute } from "../../../../lib/routes/video-job";

export const { GET, DELETE } = createVideoJobRoute(host);
