import {
  ALL_FORMATS,
  AudioBufferSink,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  canEncode,
  canEncodeAudio,
} from "mediabunny";
import { itemSeconds } from "./model";
import { SEQUENCE_LIMITS, SEQUENCE_OUTPUT_SIZE, type SequenceMedia, type SequenceNodeData } from "./types";

const SAMPLE_RATE = 48_000;
const CHANNELS = 2;

export class SequenceRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SequenceRenderError";
  }
}

export async function browserCanExport(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (typeof VideoEncoder === "undefined" || typeof AudioEncoder === "undefined") {
    return { ok: false, reason: "This browser cannot encode video. Use a current Chrome, Edge or Safari." };
  }
  if (!(await canEncode("avc"))) return { ok: false, reason: "This browser cannot encode H.264 video." };
  if (!(await canEncodeAudio("aac"))) {
    return { ok: false, reason: "This browser cannot encode AAC audio. Use a current Chrome, Edge or Safari." };
  }
  return { ok: true };
}

// Same-origin fetch: local uploads are app-relative; remote assets go through
// the download-asset route so storage CORS never matters.
async function fetchSource(url: string, label: string): Promise<Blob> {
  const target = url.startsWith("/") ? url : `/api/download-asset?url=${encodeURIComponent(url)}&filename=source`;
  const response = await fetch(target);
  if (!response.ok) {
    throw new SequenceRenderError(`${label}: download failed with HTTP ${response.status} (${url})`);
  }
  return response.blob();
}

function silence(seconds: number): AudioBuffer {
  return new AudioBuffer({
    length: Math.max(1, Math.round(seconds * SAMPLE_RATE)),
    numberOfChannels: CHANNELS,
    sampleRate: SAMPLE_RATE,
  });
}

// Copies the part of `buffer` (starting at `bufferStart` seconds) that falls
// inside [from, to).
function sliceAudio(buffer: AudioBuffer, bufferStart: number, from: number, to: number): AudioBuffer | null {
  const startFrame = Math.max(0, Math.round((from - bufferStart) * buffer.sampleRate));
  const endFrame = Math.min(buffer.length, Math.round((to - bufferStart) * buffer.sampleRate));
  if (endFrame <= startFrame) return null;
  const sliced = new AudioBuffer({
    length: endFrame - startFrame,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  });
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    sliced.copyToChannel(buffer.getChannelData(channel).subarray(startFrame, endFrame), channel);
  }
  return sliced;
}

function concatAudio(slices: AudioBuffer[], label: string): AudioBuffer {
  const [first] = slices;
  const mismatched = slices.find(
    (slice) => slice.sampleRate !== first.sampleRate || slice.numberOfChannels !== first.numberOfChannels,
  );
  if (mismatched) {
    throw new SequenceRenderError(`${label}: the audio track changes format mid-clip`);
  }
  const joined = new AudioBuffer({
    length: slices.reduce((sum, slice) => sum + slice.length, 0),
    numberOfChannels: first.numberOfChannels,
    sampleRate: first.sampleRate,
  });
  let offset = 0;
  for (const slice of slices) {
    for (let channel = 0; channel < slice.numberOfChannels; channel += 1) {
      joined.copyToChannel(slice.getChannelData(channel), channel, offset);
    }
    offset += slice.length;
  }
  return joined;
}

// Resamples and up/down-mixes to the output format with the browser's own
// audio engine; mono is spread to both stereo channels.
async function toOutputFormat(buffer: AudioBuffer): Promise<AudioBuffer> {
  if (buffer.sampleRate === SAMPLE_RATE && buffer.numberOfChannels === CHANNELS) return buffer;
  const context = new OfflineAudioContext({
    numberOfChannels: CHANNELS,
    length: Math.max(1, Math.round(buffer.duration * SAMPLE_RATE)),
    sampleRate: SAMPLE_RATE,
  });
  const player = context.createBufferSource();
  player.buffer = buffer;
  player.connect(context.destination);
  player.start();
  return context.startRendering();
}

export async function renderSequence(input: {
  data: SequenceNodeData;
  mediaById: Record<string, SequenceMedia>;
  onProgress: (fraction: number) => void;
  signal: AbortSignal;
}): Promise<{ blob: Blob; durationSeconds: number; width: number; height: number }> {
  const { width, height } = SEQUENCE_OUTPUT_SIZE[input.data.aspectRatio];
  const frameDuration = 1 / SEQUENCE_LIMITS.fps;
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new SequenceRenderError("Could not create a 2D canvas for rendering");

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const videoSource = new CanvasSource(canvas, { codec: "avc", quality: QUALITY_HIGH });
  // Every buffer added must share one format, so clip audio is converted to
  // SAMPLE_RATE / CHANNELS (see toOutputFormat) before it is added.
  const audioSource = new AudioBufferSource({ codec: "aac", quality: QUALITY_HIGH });
  output.addVideoTrack(videoSource, { frameRate: SEQUENCE_LIMITS.fps });
  output.addAudioTrack(audioSource);
  await output.start();

  const durations = input.data.items.map((item) => itemSeconds(item, input.mediaById[item.sourceNodeId]));
  const totalSeconds = durations.reduce((sum, seconds) => sum + seconds, 0);
  let offset = 0;

  const drawFitted = (source: CanvasImageSource, sourceWidth: number, sourceHeight: number) => {
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    context.fillStyle = "#000";
    context.fillRect(0, 0, width, height);
    context.drawImage(source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  };

  try {
    for (const [index, item] of input.data.items.entries()) {
      const label = `Item ${index + 1}`;
      const media = input.mediaById[item.sourceNodeId];
      const seconds = durations[index];
      const frames = Math.round(seconds * SEQUENCE_LIMITS.fps);
      const blob = await fetchSource(media.url, label);

      if (item.kind === "image") {
        const bitmap = await createImageBitmap(blob).catch((error: Error) => {
          throw new SequenceRenderError(`${label}: could not decode the image (${error.message})`);
        });
        drawFitted(bitmap, bitmap.width, bitmap.height);
        for (let frame = 0; frame < frames; frame += 1) {
          if (input.signal.aborted) throw new DOMException("Export cancelled", "AbortError");
          await videoSource.add(offset + frame * frameDuration, frameDuration);
          input.onProgress((offset + frame * frameDuration) / totalSeconds);
        }
        await audioSource.add(silence(seconds));
      } else {
        const source = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
        const videoTrack = await source.getPrimaryVideoTrack();
        if (!videoTrack) throw new SequenceRenderError(`${label}: the file has no video track`);
        const sink = new CanvasSink(videoTrack, { width, height, fit: "contain" });
        const timestamps = Array.from({ length: frames }, (_, frame) => item.trimStart + frame * frameDuration);
        let frame = 0;
        let last: CanvasImageSource | null = null;
        for await (const wrapped of sink.canvasesAtTimestamps(timestamps)) {
          if (input.signal.aborted) throw new DOMException("Export cancelled", "AbortError");
          if (wrapped) last = wrapped.canvas;
          if (last) drawFitted(last, width, height);
          else {
            context.fillStyle = "#000";
            context.fillRect(0, 0, width, height);
          }
          await videoSource.add(offset + frame * frameDuration, frameDuration);
          input.onProgress((offset + frame * frameDuration) / totalSeconds);
          frame += 1;
        }

        const audioTrack = await source.getPrimaryAudioTrack();
        let audioSeconds = 0;
        if (audioTrack) {
          const end = item.trimStart + seconds;
          const slices: AudioBuffer[] = [];
          let covered = item.trimStart;
          for await (const wrapped of new AudioBufferSink(audioTrack).buffers(item.trimStart, end)) {
            const sliced = sliceAudio(wrapped.buffer, wrapped.timestamp, covered, end);
            if (!sliced) continue;
            slices.push(sliced);
            covered += sliced.duration;
          }
          if (slices.length > 0) {
            const converted = await toOutputFormat(concatAudio(slices, label));
            await audioSource.add(converted);
            audioSeconds = converted.duration;
          }
        }
        // Keep audio exactly as long as the item's video, so later items stay in sync.
        if (seconds - audioSeconds > 1 / SAMPLE_RATE) await audioSource.add(silence(seconds - audioSeconds));
        source.dispose();
      }
      offset += frames * frameDuration;
    }
    await output.finalize();
  } catch (error) {
    await output.cancel();
    throw error;
  }

  const buffer = (output.target as BufferTarget).buffer;
  if (!buffer) throw new SequenceRenderError("The renderer produced no file");
  return { blob: new Blob([buffer], { type: "video/mp4" }), durationSeconds: offset, width, height };
}
