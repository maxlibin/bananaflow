import { host } from "../../../host";
import { createRemoveBgRoute } from "../../../lib/routes/advanced-ops";

export const maxDuration = 300;

export const { POST } = createRemoveBgRoute(host);
