"use client";

import { memo, useEffect } from "react";
import { Clapperboard, RefreshCw } from "lucide-react";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { NodeBox } from "./node-box";
import { DirectionPicker } from "../../direction/direction-picker";
import { useReadOnly } from "../readonly-context";
import { useShallow } from "zustand/react/shallow";
import { useBoardStore } from "../../../stores/board-store";
import {
  compileShotPrompt,
  compileStillPrompt,
  modelFamilyFromModelId,
} from "../../../lib/script/compile-shot";
import { extractScenes, hashScene } from "../../../lib/script/scenes";
import {
  SHOT_FRAMINGS,
  type ScriptNodeData,
  type Shot,
  type ShotCameraMove,
  type ShotFraming,
  type ShotNodeData,
} from "../../../lib/script/types";

interface ShotNodeProps {
  id: string;
  data: ShotNodeData & {
    onDelete?: (nodeId: string) => void;
  };
  isConnectable?: boolean;
  selected?: boolean;
}

type SceneState = "current" | "changed" | "removed";

type SceneLookup = {
  state: SceneState;
  heading: string | null;
  // Script nodes saved before presets have no look/lighting fields.
  look: ScriptNodeData["look"];
  lighting: ScriptNodeData["lighting"];
};

const ShotNode = memo(({ id, data, isConnectable, selected }: ShotNodeProps) => {
  const { isReadOnly } = useReadOnly();
  const updateNodeData = useBoardStore((state) => state.updateNodeData);
  const { shot } = data;

  const targetModelId = useBoardStore((state) => {
    const targetIds = new Set(
      state.edges.filter((item) => item.source === id).map((item) => item.target),
    );
    const target = state.nodes.find(
      (node) => node.type === "videoNode" && targetIds.has(node.id),
    );
    const model = (target?.data as { selectedModel?: unknown } | undefined)?.selectedModel;
    return typeof model === "string" ? model : "";
  });

  const scene = useBoardStore(
    useShallow((state): SceneLookup => {
      const scriptNode = state.nodes.find((node) => node.id === shot.scriptNodeId);
      if (!scriptNode) return { state: "removed", heading: null, look: null, lighting: null };
      const scriptData = scriptNode.data as ScriptNodeData;
      const direction = { look: scriptData.look ?? null, lighting: scriptData.lighting ?? null };
      const match = extractScenes(scriptData.doc).find((item) => item.sceneId === shot.sceneId);
      if (!match) return { state: "removed", heading: null, ...direction };
      return {
        state: hashScene(match) === shot.sceneHash ? "current" : "changed",
        heading: match.heading,
        ...direction,
      };
    }),
  );
  const sceneState = scene.state;
  const scriptDirection = { look: scene.look, lighting: scene.lighting };

  useEffect(() => {
    if (isReadOnly) return;
    const direction = { look: scene.look, lighting: scene.lighting };
    const compiled = compileShotPrompt(shot, modelFamilyFromModelId(targetModelId), direction);
    const still = compileStillPrompt(shot, direction);
    if (compiled !== data.value || still !== data.stillPrompt) {
      updateNodeData(id, { value: compiled, stillPrompt: still });
    }
  }, [
    id,
    isReadOnly,
    shot,
    targetModelId,
    scene.look,
    scene.lighting,
    data.value,
    data.stillPrompt,
    updateNodeData,
  ]);

  const updateShot = (patch: Partial<Shot>) => {
    const next = { ...shot, ...patch };
    updateNodeData(id, {
      shot: next,
      value: compileShotPrompt(next, modelFamilyFromModelId(targetModelId), scriptDirection),
      stillPrompt: compileStillPrompt(next, scriptDirection),
    });
  };

  const fieldClass = "nodrag h-7 text-xs";

  return (
    <NodeBox
      id={id}
      title={scene.heading ? `${scene.heading} · Shot ${shot.order}` : `Shot ${shot.order}`}
      icon={<Clapperboard className="h-4 w-4 text-teal-500" />}
      nodeType="shotNode"
      onDelete={data.onDelete}
      isConnectable={isConnectable}
      selected={selected}
      targetHandleId="script"
    >
      <div className="flex w-[280px] flex-col gap-1.5" data-testid="shot-node">
        {sceneState !== "current" && (
          <div className="flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-700 dark:bg-amber-950/40">
            <RefreshCw className="h-3 w-3" />
            {sceneState === "changed"
              ? "Scene changed. Re-break it from the Script panel."
              : "Scene was removed from the script."}
          </div>
        )}
        <div className="grid grid-cols-[1fr_56px] gap-1">
          <select
            value={shot.framing}
            disabled={isReadOnly}
            onChange={(event) => updateShot({ framing: event.target.value as ShotFraming })}
            className={`${fieldClass} rounded-md border bg-transparent px-1`}
            aria-label="Framing"
          >
            {SHOT_FRAMINGS.map((framing) => (
              <option key={framing} value={framing}>{framing}</option>
            ))}
          </select>

          <Input
            type="number"
            min={1}
            value={shot.duration}
            disabled={isReadOnly}
            onChange={(event) => updateShot({ duration: Number(event.target.value) })}
            className={fieldClass}
            aria-label="Duration in seconds"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <DirectionPicker
            category="camera"
            value={shot.cameraMove}
            onChange={(cameraMove) => cameraMove && updateShot({ cameraMove: cameraMove as ShotCameraMove })}
            noneLabel={null}
            disabled={isReadOnly}
          />
          <DirectionPicker
            category="lens"
            value={shot.lens ?? null}
            onChange={(lens) => updateShot({ lens: lens as Shot["lens"] })}
            noneLabel="Any"
            disabled={isReadOnly}
          />
          <DirectionPicker
            category="look"
            value={shot.look ?? null}
            onChange={(look) => updateShot({ look: look as Shot["look"] })}
            noneLabel="Script look"
            disabled={isReadOnly}
          />
          <DirectionPicker
            category="lighting"
            value={shot.lighting ?? null}
            onChange={(lighting) => updateShot({ lighting: lighting as Shot["lighting"] })}
            noneLabel="Script lighting"
            disabled={isReadOnly}
          />
        </div>
        <Textarea
          value={shot.action}
          disabled={isReadOnly}
          rows={3}
          onChange={(event) => updateShot({ action: event.target.value })}
          className="nodrag nowheel min-h-0 resize-none text-xs"
          aria-label="What happens in the shot"
        />
        {shot.dialogue.map((line, index) => (
          <div key={`${line.character}-${index}`} className="text-[11px]">
            <span className="font-semibold uppercase text-sky-600">{line.character}: </span>
            “{line.line}”
          </div>
        ))}
        {shot.voiceover && (
          <div className="text-[11px] italic text-emerald-700">VO: “{shot.voiceover}”</div>
        )}
        {shot.onScreenText && (
          <div className="text-[11px] font-medium text-amber-700">Text: {shot.onScreenText}</div>
        )}
      </div>
    </NodeBox>
  );
});

ShotNode.displayName = "ShotNode";

export default ShotNode;
