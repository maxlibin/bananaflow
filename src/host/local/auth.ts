import type { HostAdapter } from "../../lib/host/types";

// The open-source app is a single-user workspace: every request acts as
// the constant user "local". Multi-user deployments plug in their own auth
// by replacing this adapter.
export const LOCAL_USER_ID = "local";

export const localAuth: HostAdapter["auth"] = {
  async getUserId() {
    return LOCAL_USER_ID;
  },
};
