import { host } from "../../../../host";
import { createBulkRunRoute } from "../../../../lib/routes/bulk-runs";

export const { GET } = createBulkRunRoute(host);
