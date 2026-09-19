// Analytics events the canvas emits through `CanvasHost.track`. The
// open-source host ignores them; a SaaS host can forward them to its
// analytics provider.
export type TrackEventMap = {
  "generation.variants_chosen": {
    count: number;
    kind: "image" | "video";
    model?: string;
  };
  "generation.run_group_size_succeeded": {
    requested: number;
    succeeded: number;
    kind: "image" | "video";
  };
  "generation.variations_clicked": {
    parentMediaId: string;
    kind: "image" | "video";
    requested: number;
  };
  "history.opened": Record<string, never>;
  "history.rerun_clicked": {
    mediaId: string;
    kind: "image" | "video";
    source: "node" | "chat";
  };
  "history.pinned": {
    mediaId: string;
    on: boolean;
  };
  "history.jump_to_chat_clicked": {
    mediaId: string;
  };
  "bulk.submitted": {
    count: number;
    plan: string;
    model: string;
  };
  "bulk.completed": {
    bulkRunId: string;
    completed: number;
    failed: number;
    durationMs: number;
  };
  "bulk.cancelled": {
    bulkRunId: string;
    cancelledCount: number;
  };
  "bulk.item_completed": {
    bulkRunId: string;
    succeeded: boolean;
  };
  tab_opened: {
    source: "picker" | "navigation";
  };
  tab_closed: Record<string, never>;
  tab_create_new_board: Record<string, never>;
};

export type TrackFn = <K extends keyof TrackEventMap>(
  name: K,
  props?: TrackEventMap[K],
) => void;
