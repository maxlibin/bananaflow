"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Mic, Play, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { useCanvasHost } from "../canvas-host/context";
import { limitNotice } from "../../lib/host/limit-notice";
import { SpeakError, speakLine } from "../../lib/sequence/speak";
import {
  MAX_LINE_CHARACTERS,
  setVoiceAudio,
  setVoiceText,
  voiceoverStatus,
  type VoiceoverStatus,
} from "../../lib/sequence/voiceover";
import { useBoardStore } from "../../stores/board-store";
import { InvalidSequenceEditError, itemSeconds, moveItem, setHold, setTrim } from "../../lib/sequence/model";
import type { SequenceItem, SequenceMedia, SequenceVoice } from "../../lib/sequence/types";

// Keeps what the user is typing and applies it on Enter or blur, so
// intermediate values ("2" on the way to "2.5") are not rejected.
function SecondsField({
  value,
  step,
  disabled,
  testId,
  onCommit,
}: {
  value: number | "";
  step: number;
  disabled: boolean;
  testId: string;
  onCommit: (seconds: number) => boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    if (draft === String(value)) return;
    if (!onCommit(Number(draft))) setDraft(String(value));
  };
  return (
    <Input
      type="number"
      step={step}
      className="h-7 w-20"
      value={draft}
      disabled={disabled}
      data-testid={testId}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
    />
  );
}

const STATUS_LABEL: Record<VoiceoverStatus, (seconds: number, audioSeconds: number) => string> = {
  none: () => "no line",
  unvoiced: () => "not voiced",
  stale: () => "needs voicing",
  "too-long": (seconds, audioSeconds) => `too long: ${audioSeconds.toFixed(1)}s > ${seconds.toFixed(1)}s`,
  ready: (_seconds, audioSeconds) => `voiced · ${audioSeconds.toFixed(1)}s`,
};

function VoiceoverRow({
  nodeId,
  items,
  index,
  voice,
  seconds,
  onChange,
}: {
  nodeId: string;
  items: SequenceItem[];
  index: number;
  voice: SequenceVoice | null;
  seconds: number;
  onChange: (items: SequenceItem[]) => void;
}) {
  const canvasHost = useCanvasHost();
  const boardId = useBoardStore((state) => state.boardId);
  const voiceover = items[index].voiceover ?? null;
  const [draft, setDraft] = useState(voiceover?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setDraft(voiceover?.text ?? ""), [voiceover?.text]);
  const status = voiceoverStatus(voiceover, voice, seconds);

  const commit = () => {
    if (draft.trim() === (voiceover?.text ?? "")) return;
    try {
      onChange(setVoiceText(items, index, draft));
      setError(null);
    } catch (caught) {
      if (!(caught instanceof InvalidSequenceEditError)) throw caught;
      setError(caught.message);
    }
  };

  const voiceIt = async () => {
    if (!voice || !boardId || !voiceover) return;
    setBusy(true);
    try {
      const audio = await speakLine({ boardId, nodeId, voice, text: voiceover.text });
      onChange(setVoiceAudio(items, index, audio));
      setError(null);
    } catch (caught) {
      if (!(caught instanceof SpeakError)) throw caught;
      if (caught.denial) canvasHost.onLimit(limitNotice(caught.denial));
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1 flex w-full flex-wrap items-center gap-2">
      <Textarea
        className="min-h-8 flex-1 text-xs"
        placeholder="Voiceover line (optional)"
        value={draft}
        maxLength={MAX_LINE_CHARACTERS}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        data-testid={`sequence-voice-text-${index}`}
      />
      <span
        className={`rounded-full border px-2 py-0.5 text-[11px] ${status === "too-long" ? "border-red-400 text-red-600" : "text-muted-foreground"}`}
        data-testid={`sequence-voice-status-${index}`}
      >
        {STATUS_LABEL[status](seconds, voiceover?.audio?.seconds ?? 0)}
      </span>
      {status === "ready" && voiceover?.audio && (
        <Button size="icon" variant="ghost" aria-label="Play line" onClick={() => void new Audio(voiceover.audio!.url).play()}>
          <Play className="h-3.5 w-3.5" />
        </Button>
      )}
      {(status === "unvoiced" || status === "stale") && (
        <Button size="sm" variant="secondary" disabled={!voice || busy} onClick={() => void voiceIt()} data-testid={`sequence-voice-line-${index}`}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}
          Voice this line
        </Button>
      )}
      {error && <div className="w-full text-xs text-red-600">{error}</div>}
    </div>
  );
}

export function SequenceTimeline({
  nodeId,
  items,
  mediaById,
  voice,
}: {
  nodeId: string;
  items: SequenceItem[];
  mediaById: Record<string, SequenceMedia | null>;
  voice: SequenceVoice | null;
}) {
  const updateNodeData = useBoardStore((state) => state.updateNodeData);
  const removeEdgesByConnection = useBoardStore((state) => state.removeEdgesByConnection);
  const [error, setError] = useState<string | null>(null);

  const apply = (edit: () => SequenceItem[]): boolean => {
    try {
      updateNodeData(nodeId, { items: edit() });
      setError(null);
      return true;
    } catch (caught) {
      if (!(caught instanceof InvalidSequenceEditError)) throw caught;
      setError(caught.message);
      return false;
    }
  };

  return (
    <div className="flex flex-col gap-1" data-testid="sequence-timeline">
      {items.map((item, index) => {
        const media = mediaById[item.sourceNodeId];
        const clipSeconds = media?.kind === "video" ? media.seconds : null;
        const rowSeconds =
          media && (media.kind === "image" || media.seconds !== null) ? itemSeconds(item, media) : Number.POSITIVE_INFINITY;
        return (
          <div key={item.sourceNodeId} className="flex flex-wrap items-center gap-2 rounded border p-1.5 text-xs" data-testid={`sequence-item-${index}`}>
            <span className="w-5 text-muted-foreground">{index + 1}</span>
            <Button size="icon" variant="ghost" disabled={index === 0} onClick={() => apply(() => moveItem(items, index, index - 1))} aria-label="Move up">
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" disabled={index === items.length - 1} onClick={() => apply(() => moveItem(items, index, index + 1))} aria-label="Move down">
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            {item.kind === "video" ? (
              <>
                <span>Clip</span>
                <SecondsField
                  value={item.trimStart}
                  step={0.1}
                  disabled={clipSeconds === null}
                  testId={`sequence-trim-start-${index}`}
                  onCommit={(seconds) => apply(() => setTrim(items, index, seconds, item.trimEnd, clipSeconds as number))}
                />
                <span>to</span>
                <SecondsField
                  value={item.trimEnd ?? clipSeconds ?? ""}
                  step={0.1}
                  disabled={clipSeconds === null}
                  testId={`sequence-trim-end-${index}`}
                  onCommit={(seconds) => apply(() => setTrim(items, index, item.trimStart, seconds, clipSeconds as number))}
                />
                <span className="text-muted-foreground">{clipSeconds === null ? "loading…" : `of ${clipSeconds.toFixed(1)}s`}</span>
              </>
            ) : (
              <>
                <span>Still for</span>
                <SecondsField
                  value={item.holdSeconds}
                  step={0.5}
                  disabled={false}
                  testId={`sequence-hold-${index}`}
                  onCommit={(seconds) => apply(() => setHold(items, index, seconds))}
                />
                <span>s</span>
              </>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="ml-auto"
              aria-label="Remove from sequence"
              data-testid={`sequence-remove-${index}`}
              onClick={() => removeEdgesByConnection({ source: item.sourceNodeId, target: nodeId, targetHandle: "items" })}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
            <VoiceoverRow
              nodeId={nodeId}
              items={items}
              index={index}
              voice={voice}
              seconds={rowSeconds}
              onChange={(next) => updateNodeData(nodeId, { items: next })}
            />
          </div>
        );
      })}
      {error && <div className="text-xs text-red-600" data-testid="sequence-edit-error">{error}</div>}
    </div>
  );
}
