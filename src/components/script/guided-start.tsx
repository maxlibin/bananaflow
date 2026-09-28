"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import type {
  ScriptAssistant,
  ScriptBrief,
  ScriptConcept,
  ScriptDraft,
} from "../../lib/script/assistant";

type Step = "brief" | "concepts";

const BRIEF_FIELDS: Array<{
  key: "product" | "audience" | "goal" | "tone";
  label: string;
  placeholder: string;
}> = [
  { key: "product", label: "What are we making this for?", placeholder: "e.g. Glow serum, a vitamin C serum for dull skin" },
  { key: "audience", label: "Who is watching?", placeholder: "e.g. Women 25-35 with busy mornings" },
  { key: "goal", label: "What should they do or feel after?", placeholder: "e.g. Tap 'Shop now' / feel the product is effortless" },
  { key: "tone", label: "Tone", placeholder: "e.g. Warm, honest, a little funny" },
];

export function GuidedStart({
  assistant,
  modelId,
  brief,
  onBriefChange,
  onDraft,
}: {
  assistant: ScriptAssistant;
  modelId: string;
  brief: ScriptBrief;
  onBriefChange: (brief: ScriptBrief) => void;
  onDraft: (draft: ScriptDraft) => void;
}) {
  const [step, setStep] = useState<Step>("brief");
  const [concepts, setConcepts] = useState<ScriptConcept[]>([]);
  const [pending, setPending] = useState<"concepts" | number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canPitch = brief.product.trim().length > 0 && brief.audience.trim().length > 0;

  const pitch = async () => {
    setPending("concepts");
    setError(null);
    try {
      setConcepts(await assistant.proposeConcepts({ brief, modelId }));
      setStep("concepts");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(null);
    }
  };

  const write = async (concept: ScriptConcept, index: number) => {
    setPending(index);
    setError(null);
    try {
      onDraft(await assistant.writeScript({ brief, concept, modelId }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(null);
    }
  };

  if (step === "concepts") {
    return (
      <div className="flex flex-col gap-3 p-4" data-testid="script-concepts">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Pick a direction</h3>
          <Button variant="ghost" size="sm" onClick={() => setStep("brief")}>
            Edit brief
          </Button>
        </div>
        {concepts.map((concept, index) => (
          <div key={concept.title} className="rounded-md border p-3 text-sm">
            <div className="font-semibold">{concept.title}</div>
            <div className="mt-1 text-muted-foreground">{concept.logline}</div>
            <div className="mt-2 text-xs">
              <span className="font-medium">Angle:</span> {concept.angle}
            </div>
            <div className="mt-1 text-xs">
              <span className="font-medium">Hook:</span> “{concept.hook}”
            </div>
            <Button
              size="sm"
              className="mt-3"
              disabled={pending !== null}
              onClick={() => void write(concept, index)}
              data-testid="script-write-concept"
            >
              {pending === index ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Write this script
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" disabled={pending !== null} onClick={() => void pitch()}>
          {pending === "concepts" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Pitch 3 new directions
        </Button>
        {error && <div className="text-xs text-red-600">{error}</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4" data-testid="script-brief">
      <p className="text-sm text-muted-foreground">
        Answer a few questions and the AI pitches three directions. Pick one and it writes the full script.
      </p>
      {BRIEF_FIELDS.map((field) => (
        <div key={field.key} className="flex flex-col gap-1">
          <Label className="text-xs">{field.label}</Label>
          <Input
            value={brief[field.key]}
            placeholder={field.placeholder}
            onChange={(event) => onBriefChange({ ...brief, [field.key]: event.target.value })}
          />
        </div>
      ))}
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Anything else? (offer, must-say lines, references)</Label>
        <Textarea
          value={brief.notes}
          rows={3}
          onChange={(event) => onBriefChange({ ...brief, notes: event.target.value })}
        />
      </div>
      <Button disabled={!canPitch || pending !== null} onClick={() => void pitch()} data-testid="script-pitch">
        {pending === "concepts" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Pitch 3 directions
      </Button>
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}
