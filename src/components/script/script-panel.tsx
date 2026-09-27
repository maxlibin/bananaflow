"use client";

import { useEffect, useRef, useState } from "react";
import { createId } from "@paralleldrive/cuid2";
import { Clapperboard, Loader2 } from "lucide-react";
import type { Node } from "@xyflow/react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { useCanvasHost } from "../canvas-host/context";
import { useReadOnly } from "../flow/readonly-context";
import { useBoardStore } from "../../stores/board-store";
import { GuidedStart } from "./guided-start";
import { ScriptDoctor } from "./script-doctor";
import { ScriptEditor } from "./script-editor";
import type { ScriptBrief, ScriptDraft } from "../../lib/script/assistant";
import { draftToDoc } from "../../lib/script/draft-to-doc";
import { extractScenes, hashScene, sceneToText } from "../../lib/script/scenes";
import { STORY_STRUCTURES, buildStructureSkeleton } from "../../lib/script/structures";
import { clipSecondsRange, estimateSceneTiming } from "../../lib/script/timing";
import type { ScriptDoc, ScriptNodeData, ShotNodeData, StructureId } from "../../lib/script/types";
import { cn } from "../../lib/utils";

type Tab = "write" | "guided" | "doctor";

// Editor changes land in a ref; React state and the board store (which every
// node subscribes to) update once typing pauses. Setting state inside Slate's
// change callback on every keystroke overflows React's nested-update limit
// during fast input or paste.
const DOC_SAVE_DELAY_MS = 300;

const ASPECT_RATIOS = ["9:16", "16:9", "1:1", "4:5"];

function hasWrittenLines(doc: ScriptDoc): boolean {
  return extractScenes(doc).some((scene) => scene.lines.length > 0);
}

// Scenes that have no shots yet, or whose text changed since their shots
// were made. Re-breaking only these keeps untouched shots (and their videos).
function scenesNeedingShots(doc: ScriptDoc, scriptNodeId: string, nodes: Node[]) {
  const shotHashes = new Map<string, string>();
  for (const node of nodes) {
    if (node.type !== "shotNode") continue;
    const shot = (node.data as ShotNodeData).shot;
    if (shot.scriptNodeId === scriptNodeId) shotHashes.set(shot.sceneId, shot.sceneHash);
  }
  return extractScenes(doc).filter(
    (scene) => scene.lines.length > 0 && shotHashes.get(scene.sceneId) !== hashScene(scene),
  );
}

export function ScriptPanel({
  nodeId,
  open,
  onOpenChange,
}: {
  nodeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Read from the board store, not React Flow node props: props lag one
  // render behind store updates, which would mount the editor on a stale doc.
  const data = useBoardStore((state) => {
    const node = state.nodes.find((item) => item.id === nodeId);
    if (!node) {
      throw new Error(`Script node ${nodeId} is not on this board`);
    }
    return node.data as ScriptNodeData;
  });
  const { scriptAssistant, models } = useCanvasHost();
  const { isReadOnly } = useReadOnly();
  const updateNodeData = useBoardStore((state) => state.updateNodeData);
  const applyShotPlans = useBoardStore((state) => state.applyShotPlans);
  const nodes = useBoardStore((state) => state.nodes);

  const videoModels = models.video.filter((model) => !model.isComingSoon);
  const [tab, setTab] = useState<Tab>(
    scriptAssistant && !hasWrittenLines(data.doc) ? "guided" : "write",
  );
  const [modelId, setModelId] = useState(scriptAssistant?.defaultModelId ?? "");
  const [videoModelId, setVideoModelId] = useState(videoModels[0]?.value ?? "");
  const [editorVersion, setEditorVersion] = useState(0);
  const [breaking, setBreaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<ScriptNodeData>) => updateNodeData(nodeId, patch);

  const [doc, setDoc] = useState<ScriptDoc>(data.doc);
  const unsavedDoc = useRef<ScriptDoc | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushDoc = (): ScriptDoc => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const latest = unsavedDoc.current;
    if (!latest) return doc;
    unsavedDoc.current = null;
    setDoc(latest);
    updateNodeData(nodeId, { doc: latest });
    return latest;
  };

  const editDoc = (next: ScriptDoc) => {
    unsavedDoc.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flushDocRef.current(), DOC_SAVE_DELAY_MS);
  };

  const flushDocRef = useRef(flushDoc);
  flushDocRef.current = flushDoc;
  useEffect(() => () => {
    flushDocRef.current();
  }, []);

  const replaceDoc = (next: ScriptDoc) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    unsavedDoc.current = null;
    setDoc(next);
    update({ doc: next });
    setEditorVersion((version) => version + 1);
  };

  const brief: ScriptBrief = {
    ...data.brief,
    platform: data.platform,
    targetDuration: data.targetDuration,
    structureId: data.structureId,
  };

  const changeStructure = (structureId: StructureId) => {
    update({ structureId });
    if (!hasWrittenLines(doc)) {
      replaceDoc(
        buildStructureSkeleton({
          structureId,
          targetDuration: data.targetDuration,
          createSceneId: createId,
        }),
      );
    }
  };

  const applyDraft = (draft: ScriptDraft) => {
    update({ title: draft.title, logline: draft.logline });
    replaceDoc(draftToDoc(draft, createId));
    setTab("write");
  };

  const pendingScenes = scenesNeedingShots(doc, nodeId, nodes);

  const breakIntoShots = async () => {
    if (!scriptAssistant) return;
    const scenesToBreak = scenesNeedingShots(flushDoc(), nodeId, nodes);
    setBreaking(true);
    setError(null);
    try {
      const plans = await scriptAssistant.breakIntoShots({
        scenes: scenesToBreak.map((scene) => ({
          sceneId: scene.sceneId,
          text: sceneToText(scene),
          seconds: estimateSceneTiming(scene).seconds,
        })),
        aspectRatio: data.aspectRatio,
        shotSeconds: clipSecondsRange(models.videoSettings[videoModelId] ?? {}),
        modelId,
      });
      applyShotPlans({
        scriptNodeId: nodeId,
        plans,
        sceneHashes: Object.fromEntries(
          scenesToBreak.map((scene) => [scene.sceneId, hashScene(scene)]),
        ),
        videoModelId,
        aspectRatio: data.aspectRatio,
      });
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBreaking(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) flushDoc();
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-2xl"
        data-testid="script-panel"
      >
        <SheetHeader className="border-b p-4 pr-12">
          <SheetTitle className="sr-only">Script</SheetTitle>
          <SheetDescription className="sr-only">Write and structure your video script.</SheetDescription>
          <Input
            value={data.title}
            disabled={isReadOnly}
            onChange={(event) => update({ title: event.target.value })}
            className="h-auto border-none px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
            aria-label="Script title"
          />
          <Input
            value={data.logline}
            disabled={isReadOnly}
            placeholder="Logline: the story in one sentence"
            onChange={(event) => update({ logline: event.target.value })}
            className="h-auto border-none px-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0"
            aria-label="Logline"
          />
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1.2fr_1fr]">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px]">Structure</Label>
              <Select value={data.structureId} disabled={isReadOnly} onValueChange={(value) => changeStructure(value as StructureId)}>
                <SelectTrigger className="h-8 w-full min-w-0 text-xs [&>span]:truncate"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STORY_STRUCTURES.map((structure) => (
                    <SelectItem key={structure.id} value={structure.id} className="text-xs">
                      {structure.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px]">Length (s)</Label>
              <Input
                type="number"
                min={5}
                max={180}
                value={data.targetDuration}
                disabled={isReadOnly}
                onChange={(event) => update({ targetDuration: Number(event.target.value) })}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px]">Platform</Label>
              <Input
                value={data.platform}
                disabled={isReadOnly}
                onChange={(event) => update({ platform: event.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px]">Aspect</Label>
              <Select value={data.aspectRatio} disabled={isReadOnly} onValueChange={(value) => update({ aspectRatio: value })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map((ratio) => (
                    <SelectItem key={ratio} value={ratio} className="text-xs">{ratio}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </SheetHeader>

        <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
          <div className="flex gap-1">
            {(["write", ...(scriptAssistant && !isReadOnly ? ["guided"] : []), "doctor"] as Tab[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                data-testid={`script-tab-${item}`}
                className={cn(
                  "rounded-full border px-3 py-0.5 text-xs font-medium transition-colors",
                  tab === item
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item === "write" ? "Write" : item === "guided" ? "Start with AI" : "Script doctor"}
              </button>
            ))}
          </div>
          {scriptAssistant && (
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger className="h-7 w-auto gap-1 text-xs" aria-label="Writing model" data-testid="script-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scriptAssistant.models.map((model) => (
                  <SelectItem key={model.id} value={model.id} className="text-xs">
                    <span className="font-medium">{model.label}</span>
                    <span className="ml-1 text-muted-foreground">{model.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {tab === "write" && (
            <ScriptEditor
              key={editorVersion}
              initialDoc={doc}
              onChange={editDoc}
              assistant={isReadOnly ? null : scriptAssistant}
              readOnly={isReadOnly}
            />
          )}
          {tab === "guided" && scriptAssistant && (
            <GuidedStart
              assistant={scriptAssistant}
              modelId={modelId}
              brief={brief}
              onBriefChange={({ product, audience, goal, tone, notes }) =>
                update({ brief: { product, audience, goal, tone, notes } })
              }
              onDraft={applyDraft}
            />
          )}
          {tab === "doctor" && (
            <ScriptDoctor
              doc={doc}
              targetDuration={data.targetDuration}
              platform={data.platform}
              assistant={scriptAssistant}
              modelId={modelId}
            />
          )}
        </div>

        {scriptAssistant && !isReadOnly && (
          <div className="flex flex-wrap items-center gap-2 border-t p-3">
            <Select value={videoModelId} onValueChange={setVideoModelId}>
              <SelectTrigger className="h-8 w-48 text-xs" aria-label="Video model for shots">
                <SelectValue placeholder="Video model" />
              </SelectTrigger>
              <SelectContent>
                {videoModels.map((model) => (
                  <SelectItem key={model.value} value={model.value} className="text-xs">
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={breaking || pendingScenes.length === 0 || !videoModelId}
              onClick={() => void breakIntoShots()}
              data-testid="script-break-into-shots"
            >
              {breaking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clapperboard className="h-3.5 w-3.5" />}
              {pendingScenes.length === 0
                ? "Shots up to date"
                : `Break ${pendingScenes.length} scene${pendingScenes.length === 1 ? "" : "s"} into shots`}
            </Button>
            {error && <div className="w-full text-xs text-red-600">{error}</div>}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
