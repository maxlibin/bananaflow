import { host } from "../../../../../../../host";
import { createKieVideoWebhookRoute } from "../../../../../../../lib/routes/kie-webhooks";

export const maxDuration = 120;

export const { POST } = createKieVideoWebhookRoute(host);
