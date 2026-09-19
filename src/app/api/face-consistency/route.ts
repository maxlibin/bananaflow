import { host } from "../../../host";
import { createFaceConsistencyRoute } from "../../../lib/routes/advanced-ops";

export const maxDuration = 300;

export const { POST } = createFaceConsistencyRoute(host);
