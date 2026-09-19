import type { HostAdapter } from "../../lib/host/types";

// Kie can only call back to a public origin. Without one the in-process
// scheduler polls the provider instead, so this returns null on plain
// localhost setups.
export const localCallbacks: HostAdapter["callbacks"] = {
  publicBaseUrl() {
    const base = process.env.PUBLIC_BASE_URL;
    if (!base) return null;
    return base.replace(/\/$/, "");
  },
};
