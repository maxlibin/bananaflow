import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/db/index.ts";
import { boards } from "../src/db/schema.ts";
import { host } from "../src/host/index.ts";
import { getBoard, updateBoard } from "../src/lib/actions/boards.ts";
import { LOCAL_USER_ID } from "../src/host/local/auth.ts";

const uploads = path.join("data", "uploads", "local", "e2e");
await mkdir(uploads, { recursive: true });
for (const file of ["clip-a.mp4", "silent.mp4", "end.png", "line.wav"]) {
  await cp(path.join("e2e", "fixtures", file), path.join(uploads, file));
}

const [board] = await db.insert(boards).values({ title: "Sequence e2e", userId: LOCAL_USER_ID }).returning();
const at = (x: number) => ({ x, y: 0 });
// Node ids are unique across all boards, so scope them to this board.
const id = (name: string) => `${board.id}-${name}`;
const nodes = [
  { id: id("va"), type: "videoNode", position: at(0), data: { label: "A", result: { status: "completed", videoUrl: "/uploads/local/e2e/clip-a.mp4" } } },
  { id: id("vs"), type: "videoNode", position: at(400), data: { label: "Silent", result: { status: "completed", videoUrl: "/uploads/local/e2e/silent.mp4" } } },
  { id: id("end"), type: "outputNode", position: at(800), data: { label: "End card", result: { status: "completed", imageUrls: ["/uploads/local/e2e/end.png"] } } },
  {
    id: id("seq"),
    type: "sequenceNode",
    // Below the sources, clear of the media panel on the right.
    position: { x: 0, y: 500 },
    data: {
      label: "Sequence",
      aspectRatio: "9:16",
      voice: { model: "openai/gpt-4o-mini-tts", voiceId: "coral" },
      items: [
        { sourceNodeId: id("va"), kind: "video", trimStart: 0, trimEnd: null, voiceover: null, onScreenText: null },
        {
          sourceNodeId: id("vs"),
          kind: "video",
          trimStart: 0,
          trimEnd: null,
          // A voiced line over the clip that has no sound of its own.
          voiceover: {
            text: "Meet the stand.",
            audio: {
              url: "/uploads/local/e2e/line.wav",
              mediaId: "e2e-line",
              seconds: 1.5,
              model: "openai/gpt-4o-mini-tts",
              voiceId: "coral",
              text: "Meet the stand.",
            },
          },
          onScreenText: null,
        },
        { sourceNodeId: id("end"), kind: "image", holdSeconds: 1, voiceover: null, onScreenText: null },
      ],
      lastExport: null,
    },
  },
];
const edges = ["va", "vs", "end"].map((name) => ({ id: id(`e-${name}`), source: id(name), target: id("seq"), targetHandle: "items" }));
// updateBoard saves, then calls revalidatePath, which throws outside a Next
// request; so check the stored board instead of the returned status.
await updateBoard(host, board.id, { nodes, edges } as Parameters<typeof updateBoard>[2]);
const stored = (await getBoard(host, board.id)) as { success: boolean; board?: { nodes: Array<{ id: string }> } };
if (!stored.board?.nodes.some((node) => node.id === id("seq"))) {
  throw new Error(`Seeding board ${board.id} failed: ${JSON.stringify(stored).slice(0, 300)}`);
}
console.log(board.id);
process.exit(0);
