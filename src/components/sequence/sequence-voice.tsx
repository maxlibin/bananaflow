"use client";

import { useState } from "react";
import { Loader2, Mic, Play } from "lucide-react";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useCanvasHost } from "../canvas-host/context";
import { useBoardStore } from "../../stores/board-store";
import { limitNotice } from "../../lib/host/limit-notice";
import { itemSeconds } from "../../lib/sequence/model";
import { SpeakError, speakLine } from "../../lib/sequence/speak";
import type { SequenceMedia, SequenceNodeData } from "../../lib/sequence/types";
import { setVoiceAudio, voiceoverStatus } from "../../lib/sequence/voiceover";

export function SequenceVoicePicker({
  nodeId,
  data,
  mediaById,
}: {
  nodeId: string;
  data: SequenceNodeData;
  mediaById: Record<string, SequenceMedia | null>;
}) {
  const canvasHost = useCanvasHost();
  const boardId = useBoardStore((state) => state.boardId);
  const updateNodeData = useBoardStore((state) => state.updateNodeData);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const models = canvasHost.models.speech;
  const voice = data.voice ?? null;
  const model = models.find((option) => option.value === voice?.model) ?? null;
  const sample = model?.voices.find((option) => option.id === voice?.voiceId)?.sampleUrl ?? null;

  const pending = data.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      const media = mediaById[item.sourceNodeId];
      const seconds = media && (media.kind === "image" || media.seconds !== null) ? itemSeconds(item, media) : Number.POSITIVE_INFINITY;
      const status = voiceoverStatus(item.voiceover ?? null, voice, seconds);
      return status === "unvoiced" || status === "stale";
    });
  const characters = pending.reduce((sum, { item }) => sum + (item.voiceover?.text.length ?? 0), 0);
  const price = voice ? canvasHost.costPreview({ kind: "speech", model: voice.model, characters }) : null;

  const voiceAll = async () => {
    if (!voice || !boardId) return;
    setError(null);
    let items = data.items;
    for (const [position, { item, index }] of pending.entries()) {
      setProgress(`Voicing ${position + 1} of ${pending.length}`);
      try {
        const audio = await speakLine({ boardId, nodeId, voice, text: item.voiceover!.text });
        items = setVoiceAudio(items, index, audio);
        updateNodeData(nodeId, { items });
      } catch (caught) {
        if (!(caught instanceof SpeakError)) throw caught;
        if (caught.denial) canvasHost.onLimit(limitNotice(caught.denial));
        setError(`Item ${index + 1}: ${caught.message}`);
        break;
      }
    }
    setProgress(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b pb-3" data-testid="sequence-voice">
      <span className="text-xs font-medium">Voice</span>
      <Select
        value={voice ? `${voice.model}|${voice.voiceId}` : ""}
        onValueChange={(value) => {
          const [nextModel, voiceId] = value.split("|");
          updateNodeData(nodeId, { voice: { model: nextModel, voiceId } });
        }}
      >
        <SelectTrigger className="h-8 w-60 text-xs" data-testid="sequence-voice-picker" aria-label="Narrator voice">
          <SelectValue placeholder="Pick a narrator voice" />
        </SelectTrigger>
        <SelectContent>
          {models.flatMap((option) =>
            option.voices.map((entry) => (
              <SelectItem key={`${option.value}|${entry.id}`} value={`${option.value}|${entry.id}`} className="text-xs">
                {option.label} · {entry.label}
              </SelectItem>
            )),
          )}
        </SelectContent>
      </Select>
      {sample && (
        <Button size="icon" variant="ghost" aria-label="Play voice sample" onClick={() => void new Audio(sample).play()}>
          <Play className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button
        size="sm"
        disabled={!voice || !boardId || pending.length === 0 || progress !== null}
        onClick={() => void voiceAll()}
        data-testid="sequence-voice-all"
      >
        {progress ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}
        {progress ?? `Voice all lines${pending.length ? ` (${pending.length})` : ""}${price ? ` · ~${Math.ceil(price.credits)} credits` : ""}`}
      </Button>
      {error && <div className="w-full text-xs text-red-600" data-testid="sequence-voice-error">{error}</div>}
    </div>
  );
}
