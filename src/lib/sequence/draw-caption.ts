import { CAPTION_LAYOUT, CAPTION_MAX_WIDTH, CAPTION_OUTLINE, type CaptionCue } from "./captions";

function wrapLines(context: OffscreenCanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && context.measureText(`${last} ${word}`).width <= maxWidth) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else {
      lines.push(word);
    }
  }
  return lines;
}

// White bold text with a black outline, centred on the cue's layer line.
export function drawCaption(context: OffscreenCanvasRenderingContext2D, cue: CaptionCue, width: number, height: number): void {
  const layout = CAPTION_LAYOUT[cue.layer];
  const maxWidth = width * CAPTION_MAX_WIDTH;
  let fontSize = Math.round(height * layout.size);
  context.font = `bold ${fontSize}px sans-serif`;
  const lines = wrapLines(context, cue.text, maxWidth);
  // A single word wider than the frame shrinks instead of overflowing.
  const widest = Math.max(...lines.map((line) => context.measureText(line).width));
  if (widest > maxWidth) {
    fontSize = Math.floor((fontSize * maxWidth) / widest);
    context.font = `bold ${fontSize}px sans-serif`;
  }
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.lineWidth = fontSize * CAPTION_OUTLINE;
  context.strokeStyle = "#000";
  context.fillStyle = "#fff";
  const lineHeight = fontSize * 1.2;
  const top = height * layout.y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    const y = top + index * lineHeight;
    context.strokeText(line, width / 2, y);
    context.fillText(line, width / 2, y);
  });
}
