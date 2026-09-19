import { host } from "../../../host";
import { createDownloadAssetRoute } from "../../../lib/routes/download-asset";

export const { GET } = createDownloadAssetRoute(host);
