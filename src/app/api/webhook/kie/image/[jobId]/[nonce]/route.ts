import { host } from "../../../../../../../host";
import { createKieImageWebhookRoute } from "../../../../../../../lib/routes/kie-webhooks";

export const maxDuration = 120;

export const { POST } = createKieImageWebhookRoute(host);
