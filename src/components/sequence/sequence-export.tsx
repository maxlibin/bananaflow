"use client";

import { useEffect, useRef, useState } from "react";
import { Captions, Download, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { useCanvasHost } from "../canvas-host/context";
import { useBoardStore } from "../../stores/board-store";
import { limitNotice } from "../../lib/host/limit-notice";
import { captionCues, toSrt } from "../../lib/sequence/captions";
import { downloadHref, type SequenceCheck } from "../../lib/sequence/model";
import { browserCanExport, renderSequence } from "../../lib/sequence/render";
import type { SequenceMedia, SequenceNodeData } from "../../lib/sequence/types";
import { putWithProgress } from "../../lib/sequence/upload";

type Rendered = { blob: Blob; durationSeconds: number; width: number; height: number };
type Phase =
  | { name: "idle" }
  | { name: "rendering"; fraction: number }
  | { name: "uploading"; fraction: number }
  | { name: "failed"; message: string; rendered: Rendered | null }
  | { name: "done"; url: string };

export function SequenceExport({
  nodeId,
  data,
  mediaById,
  check,
}: {
  nodeId: string;
  data: SequenceNodeData;
  mediaById: Record<string, SequenceMedia | null>;
  check: SequenceCheck;
}) {
  const canvasHost = useCanvasHost();
  const boardId = useBoardStore((state) => state.boardId);
  const updateNodeData = useBoardStore((state) => state.updateNodeData);
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [support, setSupport] = useState<{ ok: true } | { ok: false; reason: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void browserCanExport().then(setSupport);
  }, []);

  const blocked =
    support === null
      ? "Checking whether this browser can export…"
      : !support.ok
        ? support.reason
        : !check.ok
          ? check.reason
          : !boardId
            ? "Save the board before exporting"
            : null;
  // Cue times need every item's length, which a passing check guarantees.
  const srt = check.ok
    ? toSrt(captionCues(data.items, mediaById as Record<string, SequenceMedia>, data.voice ?? null, data.captions ?? null))
    : "";
  const downloadSrt = () => {
    const url = URL.createObjectURL(new Blob([srt], { type: "application/x-subrip" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "captions.srt";
    link.click();
    // Revoked after the click has handed the file to the browser.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const busy = phase.name === "rendering" || phase.name === "uploading";

  const uploadAndSave = async (rendered: Rendered, signal: AbortSignal) => {
    if (!boardId) throw new Error("This board has not been saved yet");
    setPhase({ name: "uploading", fraction: 0 });
    if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
    const created = await canvasHost.actions.createExportUpload({ boardId, nodeId, size: rendered.blob.size });
    if (!created.ok) {
      if (created.denial) canvasHost.onLimit(limitNotice(created.denial));
      setPhase({ name: "failed", message: created.error, rendered });
      return;
    }
    await putWithProgress(created.value.upload, rendered.blob, (fraction) => setPhase({ name: "uploading", fraction }), signal);
    if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
    const saved = await canvasHost.actions.saveSequenceExport({
      boardId,
      nodeId,
      key: created.value.key,
      size: rendered.blob.size,
      durationSeconds: rendered.durationSeconds,
      width: rendered.width,
      height: rendered.height,
    });
    if (!saved.ok) {
      setPhase({ name: "failed", message: saved.error, rendered });
      return;
    }
    updateNodeData(nodeId, {
      lastExport: { mediaId: saved.value.mediaId, url: saved.value.url, exportedAt: new Date().toISOString() },
    });
    setPhase({ name: "done", url: saved.value.url });
  };

  const run = async (reuse: Rendered | null) => {
    const controller = new AbortController();
    abortRef.current = controller;
    let rendered = reuse;
    try {
      if (!rendered) {
        setPhase({ name: "rendering", fraction: 0 });
        rendered = await renderSequence({
          data,
          mediaById: mediaById as Record<string, SequenceMedia>,
          onProgress: (fraction) => setPhase({ name: "rendering", fraction }),
          signal: controller.signal,
        });
      }
      await uploadAndSave(rendered, controller.signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setPhase({ name: "idle" });
        return;
      }
      setPhase({ name: "failed", message: error instanceof Error ? error.message : String(error), rendered });
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={Boolean(blocked) || busy} onClick={() => void run(null)} data-testid="sequence-export-button">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Export MP4
        </Button>
        {busy && (
          <Button size="sm" variant="ghost" onClick={() => abortRef.current?.abort()} data-testid="sequence-export-cancel">
            Cancel
          </Button>
        )}
        {srt && (
          <Button size="sm" variant="ghost" onClick={downloadSrt} data-testid="sequence-captions-srt">
            <Captions className="h-3.5 w-3.5" /> Download captions (.srt)
          </Button>
        )}
      </div>
      {blocked && <div className="text-xs text-muted-foreground" data-testid="sequence-export-reason">{blocked}</div>}
      {busy && (
        <div className="text-xs" data-testid="sequence-export-progress">
          {phase.name === "rendering" ? "Rendering" : "Uploading"} {Math.round(phase.fraction * 100)}% · Keep this tab open while exporting
        </div>
      )}
      {phase.name === "failed" && (
        <div className="flex items-center gap-2 text-xs text-red-600">
          <span data-testid="sequence-export-error">{phase.message}</span>
          {phase.rendered && (
            <Button size="sm" variant="secondary" onClick={() => void run(phase.rendered)} data-testid="sequence-export-retry">
              Retry upload
            </Button>
          )}
        </div>
      )}
      {phase.name === "done" && (
        <a href={downloadHref(phase.url, "sequence.mp4")} download className="text-xs underline" data-testid="sequence-export-done">
          Download the MP4
        </a>
      )}
    </div>
  );
}
