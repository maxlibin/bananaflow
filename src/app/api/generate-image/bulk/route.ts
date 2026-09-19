import { host } from "../../../../host";
import { createBulkGenerateRoute } from "../../../../lib/routes/bulk-runs";

export const maxDuration = 60;

export const { POST } = createBulkGenerateRoute(host);
