"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "../ui/button";
import { CAPTION_LAYOUT, CAPTION_MAX_WIDTH, CAPTION_OUTLINE, captionCues } from "../../lib/sequence/captions";
import { itemFrames, itemSeconds } from "../../lib/sequence/model";
import { SEQUENCE_LIMITS, SEQUENCE_OUTPUT_SIZE, type SequenceMedia, type SequenceNodeData } from "../../lib/sequence/types";
import { DUCK_LEVEL, voiceoverStatus } from "../../lib/sequence/voiceover";

export function SequencePlayer({
  data,
  mediaById,
}: {
  data: SequenceNodeData;
  mediaById: Record<string, SequenceMedia | null>;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const item = data.items[index];
  const media = item ? mediaById[item.sourceNodeId] : null;
  const { width, height } = SEQUENCE_OUTPUT_SIZE[data.aspectRatio];
  // Seconds into the current item, polled while playing.
  const [clock, setClock] = useState(0);

  // Cue times need every item's length, so captions wait for all media.
  const timeline = useMemo(() => {
    const known: Record<string, SequenceMedia> = {};
    for (const entry of data.items) {
      const found = mediaById[entry.sourceNodeId];
      if (!found || found.kind !== entry.kind || (found.kind === "video" && found.seconds === null)) return null;
      known[entry.sourceNodeId] = found;
    }
    let offset = 0;
    const starts = data.items.map((entry) => {
      const start = offset;
      offset += itemFrames(entry, known[entry.sourceNodeId]) / SEQUENCE_LIMITS.fps;
      return start;
    });
    return { starts, cues: captionCues(data.items, known, data.voice ?? null, data.captions ?? null) };
  }, [data.items, data.voice, data.captions, mediaById]);
  const time = (timeline?.starts[index] ?? 0) + clock;
  const activeCues = timeline?.cues.filter((cue) => cue.start <= time && time < cue.end) ?? [];

  const next = () => {
    setClock(0);
    if (index + 1 < data.items.length) setIndex(index + 1);
    else {
      setPlaying(false);
      setIndex(0);
    }
  };

  useEffect(() => {
    if (!playing || !item) return;
    if (item.kind === "image") {
      const timer = window.setTimeout(next, item.holdSeconds * 1000);
      return () => window.clearTimeout(timer);
    }
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = item.trimStart;
    void video.play();
    const onTime = () => {
      const end = item.trimEnd ?? video.duration;
      if (video.currentTime >= end) {
        video.pause();
        next();
      }
    };
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("ended", next);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("ended", next);
    };
  }, [playing, index, item]);

  useEffect(() => {
    if (!playing || !item) return;
    const startedAt = performance.now();
    let frame = 0;
    const tick = () => {
      const video = videoRef.current;
      setClock(item.kind === "video" && video ? video.currentTime - item.trimStart : (performance.now() - startedAt) / 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, index, item]);

  // The item's voiceover plays from its start; the clip is ducked under it,
  // as in the export.
  useEffect(() => {
    if (!playing || !item) return;
    const seconds =
      media && (media.kind === "image" || media.seconds !== null) ? itemSeconds(item, media) : Number.POSITIVE_INFINITY;
    const voiceover = item.voiceover ?? null;
    if (voiceoverStatus(voiceover, data.voice ?? null, seconds) !== "ready" || !voiceover?.audio) return;
    const voice = new Audio(voiceover.audio.url);
    const video = videoRef.current;
    const restore = () => {
      if (video) video.volume = 1;
    };
    if (video) video.volume = DUCK_LEVEL;
    voice.addEventListener("ended", restore);
    voice.play().catch((error: Error) => {
      restore();
      if (error.name !== "AbortError") console.error("Voiceover preview failed", error);
    });
    return () => {
      voice.pause();
      voice.removeEventListener("ended", restore);
      restore();
    };
  }, [playing, index, item, media, data.voice]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative flex items-center justify-center overflow-hidden rounded bg-black"
        style={{ aspectRatio: `${width} / ${height}`, maxHeight: 420, containerType: "size" }}
        data-testid="sequence-player"
      >
        {media?.kind === "video" && <video ref={videoRef} src={media.url} className="h-full w-full object-contain" playsInline />}
        {media?.kind === "image" && <img src={media.url} alt="" className="h-full w-full object-contain" />}
        {activeCues.map((cue) => (
          <div
            key={`${cue.layer}-${cue.start}`}
            data-testid={`sequence-caption-${cue.layer}`}
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-center font-bold leading-[1.2] text-white"
            style={{
              top: `${CAPTION_LAYOUT[cue.layer].y * 100}%`,
              width: `${CAPTION_MAX_WIDTH * 100}%`,
              fontSize: `${CAPTION_LAYOUT[cue.layer].size * 100}cqh`,
              fontFamily: "sans-serif",
              WebkitTextStroke: `${CAPTION_OUTLINE}em #000`,
              paintOrder: "stroke fill",
            }}
          >
            {cue.text}
          </div>
        ))}
      </div>
      <Button size="sm" variant="secondary" onClick={() => setPlaying(!playing)} data-testid="sequence-play-toggle">
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        {playing ? "Pause" : "Play cut"}
      </Button>
    </div>
  );
}
