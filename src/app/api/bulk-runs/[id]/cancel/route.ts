import { host } from "../../../../../host";
import { createBulkRunCancelRoute } from "../../../../../lib/routes/bulk-runs";

export const { POST } = createBulkRunCancelRoute(host);
