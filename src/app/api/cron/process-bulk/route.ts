import { host } from "../../../../host";
import { createCronRoutes } from "../../../../lib/routes/cron";
import { requireCronSecret } from "../../../../lib/routes/cron-secret";

export const maxDuration = 800;

export const { GET } = createCronRoutes(host, requireCronSecret()).processBulk;
