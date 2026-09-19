import { MAX_OPEN_TABS } from "../../lib/board-tabs-constants";
import { BULK_MAX_EXPANSION } from "../../lib/bulk-limits";
import type { HostAdapter } from "../../lib/host/types";

export const localLimits: HostAdapter["limits"] = {
  async tabLimit() {
    return MAX_OPEN_TABS;
  },
  async canCreateBoard() {
    return { ok: true };
  },
  async canPublishBoard() {
    return { ok: true };
  },
  async canStore() {
    return { ok: true };
  },
  async bulkExpansionCap() {
    return BULK_MAX_EXPANSION;
  },
  async onBoardCreated() {},
  async onStorageChanged() {},
};
