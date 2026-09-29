"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "../ui/button";
import { itemSeconds } from "../../lib/sequence/model";
import { SEQUENCE_OUTPUT_SIZE, type SequenceMedia, type SequenceNodeData } from "../../lib/sequence/types";
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

  const next = () => {
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
        style={{ aspectRatio: `${width} / ${height}`, maxHeight: 420 }}
        data-testid="sequence-player"
      >
        {media?.kind === "video" && <video ref={videoRef} src={media.url} className="h-full w-full object-contain" playsInline />}
        {media?.kind === "image" && <img src={media.url} alt="" className="h-full w-full object-contain" />}
      </div>
      <Button size="sm" variant="secondary" onClick={() => setPlaying(!playing)} data-testid="sequence-play-toggle">
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        {playing ? "Pause" : "Play cut"}
      </Button>
    </div>
  );
}
