import type { HostAdapter } from "../../lib/host/types";

// No credits, plans or rate limits: the user pays their provider directly.
export const localPolicy: HostAdapter["policy"] = {
  async beforeGenerate() {
    return { ok: true, reservedMicro: BigInt(0) };
  },
  async afterGenerate() {},
};
