"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNodeConnections, useReactFlow } from "@xyflow/react";
import NextImage from "next/image";
import { Film, Loader2, RotateCcw } from "lucide-react";
import { Button } from "../../ui/button";
import { Slider } from "../../ui/slider";
import { NodeBox } from "./node-box";
import { useReadOnly } from "../readonly-context";
import { useBoardStore } from "../../../stores/board-store";
import { useCanvasHost } from "../../canvas-host/context";
import { notifyDialog } from "../../ui/dialog-host";
import type { GenerationFeature } from "../../../lib/host/features";

interface SeedNodeData {
  label: string;
  imageUrl?: string;
  fileName?: string;
  blobPath?: string;
  fileSize?: number;
  seedTime?: number;
  onDelete?: (nodeId: string) => void;
  onCreateNode?: (nodeType: string) => void;
}

interface SeedNodeProps {
  id: string;
  data: SeedNodeData;
  isConnectable?: boolean;
  selected?: boolean;
}

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00.0";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
};

const SeedNode = memo(({ id, data, isConnectable, selected }: SeedNodeProps) => {
  const canvasHost = useCanvasHost();
  const { updateNodeData } = useReactFlow();
  const { isReadOnly } = useReadOnly();
  const boardId = useBoardStore((state) => state.boardId);
  const getNodeById = useBoardStore((state) => state.getNodeById);
  const createNodeWithType = useBoardStore((state) => state.createNodeWithType);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(data.seedTime ?? 0);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const targetConnections = useNodeConnections({
    handleType: "target",
    id,
  });

  const sourceVideoUrl = useMemo(() => {
    for (const conn of targetConnections ?? []) {
      const source = conn.source ? getNodeById(conn.source) : null;
      if (source?.type !== "videoNode") continue;
      const result = (source.data as { result?: { videoUrl?: string } } | undefined)?.result;
      if (result?.videoUrl) return result.videoUrl;
    }
    return null;
  }, [targetConnections, getNodeById]);

  useEffect(() => {
    setIsVideoReady(false);
    setDuration(0);
    setErrorMsg(null);
  }, [sourceVideoUrl]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const d = Number.isFinite(video.duration) ? video.duration : 0;
    setDuration(d);
    setIsVideoReady(true);
    const initial = Math.min(Math.max(data.seedTime ?? 0, 0), d);
    setCurrentTime(initial);
    try {
      video.currentTime = initial;
    } catch {
      /* ignore */
    }
  }, [data.seedTime]);

  const handleSliderChange = useCallback((values: number[]) => {
    const next = values[0] ?? 0;
    setCurrentTime(next);
    const video = videoRef.current;
    if (video) {
      try {
        video.currentTime = next;
      } catch {
        /* ignore seek errors */
      }
    }
  }, []);

  const seekTo = (time: number) =>
    new Promise<void>((resolve, reject) => {
      const video = videoRef.current;
      if (!video) {
        reject(new Error("Video element unavailable"));
        return;
      }
      if (Math.abs(video.currentTime - time) < 0.01) {
        resolve();
        return;
      }
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onError);
        resolve();
      };
      const onError = () => {
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onError);
        reject(new Error("Failed to seek video"));
      };
      video.addEventListener("seeked", onSeeked);
      video.addEventListener("error", onError);
      try {
        video.currentTime = time;
      } catch (err) {
        reject(err as Error);
      }
    });

  const captureFrame = async (): Promise<Blob> => {
    const video = videoRef.current;
    if (!video) throw new Error("Video element unavailable");
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) throw new Error("Video dimensions unavailable");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create canvas context");
    ctx.drawImage(video, 0, 0, width, height);
    return new Promise<Blob>((resolve, reject) => {
      try {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Canvas returned empty blob"));
          },
          "image/jpeg",
          0.92,
        );
      } catch (err) {
        // Most common cause: tainted canvas due to CORS-restricted video source.
        reject(err as Error);
      }
    });
  };

  const handleSeedFrame = useCallback(async () => {
    if (!boardId) {
      notifyDialog({
        title: "Board not ready",
        description: "Please reload the page and try again.",
      });
      return;
    }
    if (!sourceVideoUrl) return;
    setIsSeeding(true);
    setErrorMsg(null);
    try {
      await seekTo(currentTime);
      const blob = await captureFrame();
      const fileName = `seed-${Date.now()}.jpg`;
      const params = new URLSearchParams();
      params.set("filename", fileName);
      params.set("boardId", boardId);
      if (data.blobPath) params.set("previousBlobPath", data.blobPath);
      if (data.fileSize) params.set("previousSize", String(data.fileSize));
      const response = await fetch(`/api/upload-image?${params.toString()}`, {
        method: "POST",
        body: blob,
        headers: { "content-type": blob.type || "image/jpeg" },
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            blob?: { url?: string; pathname?: string };
            size?: number;
            error?: string;
            upgradeRequired?: boolean;
            feature?: GenerationFeature;
          }
        | null;
      if (!response.ok || !payload?.blob?.url) {
        if (response.status === 429 && payload?.upgradeRequired) {
          canvasHost.onLimit({
            feature: payload.feature ?? "STORAGE_BYTES",
            kind: "storage",
            severity: "warning",
            message: payload.error ?? "Storage limit reached.",
            plan: null,
          });
        }
        throw new Error(payload?.error ?? `Upload failed (${response.status})`);
      }
      updateNodeData(id, {
        imageUrl: payload.blob.url,
        blobPath: payload.blob.pathname ?? payload.blob.url,
        fileSize: payload.size,
        fileName,
        seedTime: currentTime,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to seed frame";
      const friendly =
        /tainted|SecurityError/i.test(message)
          ? "Couldn't read this video frame (CORS). The video host needs to allow cross-origin requests."
          : message;
      setErrorMsg(friendly);
    } finally {
      setIsSeeding(false);
    }
  }, [
    boardId,
    canvasHost,
    sourceVideoUrl,
    currentTime,
    data.blobPath,
    data.fileSize,
    id,
    updateNodeData,
  ]);

  const handleReseed = useCallback(() => {
    updateNodeData(id, {
      imageUrl: undefined,
      blobPath: undefined,
      fileSize: undefined,
      fileName: undefined,
    });
    setErrorMsg(null);
  }, [id, updateNodeData]);

  const renderContent = () => {
    if (data.imageUrl) {
      return (
        <div className="flex flex-col gap-2">
          <div className="relative w-full overflow-hidden rounded border border-border bg-black/5 dark:bg-white/5">
            <NextImage
              src={data.imageUrl}
              alt="Seeded frame"
              width={320}
              height={180}
              className="w-full h-auto object-contain"
              unoptimized
            />
          </div>
          {data.seedTime != null && (
            <div className="text-xs text-muted-foreground">
              Seeded at {formatTime(data.seedTime)}
            </div>
          )}
          {!isReadOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReseed}
              className="self-start"
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Re-seed
            </Button>
          )}
        </div>
      );
    }

    if (!sourceVideoUrl) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
          <Film className="h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground max-w-[220px]">
            Connect a video node to seed a frame from it.
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        <video
          ref={videoRef}
          src={sourceVideoUrl}
          crossOrigin="anonymous"
          preload="auto"
          playsInline
          muted
          onLoadedMetadata={handleLoadedMetadata}
          onError={() =>
            setErrorMsg(
              "Failed to load video. Try regenerating the source video.",
            )
          }
          className="w-full rounded border border-border bg-black"
        />
        <Slider
          min={0}
          max={Math.max(duration, 0.1)}
          step={0.1}
          value={[currentTime]}
          onValueChange={handleSliderChange}
          disabled={!isVideoReady || isSeeding || isReadOnly}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        {!isReadOnly && (
          <Button
            size="sm"
            onClick={handleSeedFrame}
            disabled={!isVideoReady || isSeeding}
            className="self-start"
          >
            {isSeeding ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Seeding…
              </>
            ) : (
              <>
                <Film className="mr-1 h-3 w-3" />
                Seed frame
              </>
            )}
          </Button>
        )}
        {errorMsg && (
          <p className="text-xs text-destructive">{errorMsg}</p>
        )}
      </div>
    );
  };

  return (
    <NodeBox
      id={id}
      title={data.label || "Seed Frame"}
      icon={<Film className="h-3 w-3" />}
      isConnectable={isConnectable}
      onDelete={data.onDelete}
      nodeType="seedNode"
      onCreateNode={data.onCreateNode}
      selected={selected}
      targetHandleId="images"
    >
      {renderContent()}
    </NodeBox>
  );
});

SeedNode.displayName = "SeedNode";

export default SeedNode;
