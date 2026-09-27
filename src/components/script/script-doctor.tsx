"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Stethoscope } from "lucide-react";
import { Button } from "../ui/button";
import type { CritiqueScore, ScriptAssistant, ScriptCritique } from "../../lib/script/assistant";
import { extractScenes, scriptToText } from "../../lib/script/scenes";
import { estimateScriptTiming } from "../../lib/script/timing";
import type { ScriptDoc } from "../../lib/script/types";
import { cn } from "../../lib/utils";

const HOOK_COUNT = 5;

function ScoreRow({ label, score }: { label: string; score: CritiqueScore }) {
  return (
    <div className="text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <span
          className={cn(
            "font-semibold",
            score.score >= 8 ? "text-green-600" : score.score >= 5 ? "text-amber-600" : "text-red-600",
          )}
        >
          {score.score}/10
        </span>
      </div>
      <div className="text-muted-foreground">{score.note}</div>
    </div>
  );
}

export function ScriptDoctor({
  doc,
  targetDuration,
  platform,
  assistant,
  modelId,
}: {
  doc: ScriptDoc;
  targetDuration: number;
  platform: string;
  assistant: ScriptAssistant | null;
  modelId: string;
}) {
  const [critique, setCritique] = useState<ScriptCritique | null>(null);
  const [hooks, setHooks] = useState<string[]>([]);
  const [pending, setPending] = useState<"critique" | "hooks" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scenes = extractScenes(doc);
  const timing = estimateScriptTiming(scenes, targetDuration);
  const scriptText = scriptToText(doc);
  const firstScene = scenes[0];
  const currentHook = firstScene?.lines.map((line) => line.text).join(" ") ?? "";

  const runCritique = async (active: ScriptAssistant) => {
    setPending("critique");
    setError(null);
    try {
      setCritique(await active.critique({ scriptText, targetDuration, platform, modelId }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(null);
    }
  };

  const runHooks = async (active: ScriptAssistant) => {
    setPending("hooks");
    setError(null);
    try {
      setHooks(await active.alternativeHooks({ scriptText, currentHook, count: HOOK_COUNT }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="script-doctor">
      <section>
        <h3 className="text-sm font-semibold">Timing</h3>
        <div
          className={cn(
            "mt-1 text-xs",
            timing.overTarget ? "text-red-600" : "text-muted-foreground",
          )}
        >
          {timing.totalSeconds}s of {timing.targetSeconds}s target
          {timing.overTarget && " — too long, cut or tighten a scene"}
        </div>
        <ul className="mt-2 space-y-1">
          {timing.scenes.map((scene) => (
            <li key={scene.sceneId} className="flex items-center justify-between text-xs">
              <span className="truncate">{scene.heading || "Untitled scene"}</span>
              <span className={cn("flex items-center gap-1", scene.overPlanned && "text-amber-600")}>
                {scene.overPlanned && <AlertTriangle className="h-3 w-3" />}
                {scene.seconds}s
                {scene.plannedSeconds !== null && ` / ${scene.plannedSeconds}s planned`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {assistant && (
        <>
          <section className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pending !== null || scenes.length === 0}
              onClick={() => void runCritique(assistant)}
              data-testid="script-run-doctor"
            >
              {pending === "critique" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Stethoscope className="h-3.5 w-3.5" />}
              Run script doctor
            </Button>
            {critique && (
              <div className="flex flex-col gap-2 rounded-md border p-3">
                <div className="text-sm font-semibold">Overall {critique.overall}/10</div>
                <ScoreRow label="Hook" score={critique.hook} />
                <ScoreRow label="Clarity" score={critique.clarity} />
                <ScoreRow label="Pacing" score={critique.pacing} />
                <ScoreRow label="Can AI video render it?" score={critique.visualFeasibility} />
                <ScoreRow label="Call to action" score={critique.callToAction} />
                {critique.fixes.length > 0 && (
                  <ul className="mt-1 space-y-1.5 border-t pt-2">
                    {critique.fixes.map((fix) => (
                      <li key={`${fix.sceneHeading}-${fix.issue}`} className="text-xs">
                        {fix.sceneHeading && <span className="font-medium">{fix.sceneHeading}: </span>}
                        {fix.issue} <span className="text-muted-foreground">→ {fix.suggestion}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pending !== null || !currentHook}
              onClick={() => void runHooks(assistant)}
            >
              {pending === "hooks" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {HOOK_COUNT} alternative hooks
            </Button>
            {hooks.length > 0 && (
              <ul className="space-y-1.5">
                {hooks.map((hook) => (
                  <li key={hook} className="flex items-start justify-between gap-2 rounded border p-2 text-xs">
                    <span>{hook}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 shrink-0 px-2 text-[11px]"
                      onClick={() => void navigator.clipboard.writeText(hook)}
                    >
                      Copy
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}
