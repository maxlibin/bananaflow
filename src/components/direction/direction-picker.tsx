"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { useCanvasHost } from "../canvas-host/context";
import {
  DIRECTION_PRESETS,
  directionSampleKey,
  type DirectionCategory,
  type DirectionPreset,
} from "../../lib/direction/presets";
import { cn } from "../../lib/utils";

const CATEGORY_LABELS: Record<DirectionCategory, string> = {
  camera: "Camera",
  lens: "Lens",
  look: "Look",
  lighting: "Lighting",
};

function PresetCard({
  preset,
  selected,
  onSelect,
}: {
  preset: DirectionPreset;
  selected: boolean;
  onSelect: () => void;
}) {
  const { directionSamples } = useCanvasHost();
  const sample = directionSamples[directionSampleKey(preset.category, preset.id)];
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`direction-preset-${preset.category}-${preset.id}`}
      className={cn(
        "group/preset flex flex-col overflow-hidden rounded-md border text-left transition-colors hover:border-primary/60",
        selected && "border-primary ring-2 ring-primary/30",
      )}
    >
      <div className="relative aspect-video w-full bg-muted">
        {sample?.videoUrl ? (
          <video
            src={sample.videoUrl}
            poster={sample.imageUrl ?? undefined}
            muted
            loop
            playsInline
            preload="none"
            onMouseEnter={(event) => void event.currentTarget.play()}
            onMouseLeave={(event) => event.currentTarget.pause()}
            className="h-full w-full object-cover"
          />
        ) : sample?.imageUrl ? (
          <img src={sample.imageUrl} alt={preset.label} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-[10px] text-muted-foreground">
            {preset.description}
          </div>
        )}
        {selected && (
          <Check className="absolute right-1 top-1 h-4 w-4 rounded-full bg-primary p-0.5 text-primary-foreground" />
        )}
      </div>
      <div className="px-1.5 py-1">
        <div className="text-[11px] font-medium leading-tight">{preset.label}</div>
        {(sample?.videoUrl || sample?.imageUrl) && (
          <div className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">
            {preset.description}
          </div>
        )}
      </div>
    </button>
  );
}

// A chip that opens a gallery of one preset category. `noneLabel` names the
// empty choice (e.g. "Script look") when the category is optional.
export function DirectionPicker({
  category,
  value,
  onChange,
  noneLabel,
  disabled,
}: {
  category: DirectionCategory;
  value: string | null;
  onChange: (id: string | null) => void;
  noneLabel: string | null;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const presets = DIRECTION_PRESETS.filter((preset) => preset.category === category);
  const current = presets.find((preset) => preset.id === value);
  const choose = (id: string | null) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          data-testid={`direction-picker-${category}`}
          className="nodrag inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2 py-0.5 text-[11px] hover:bg-muted disabled:opacity-60"
        >
          <span className="text-muted-foreground">{CATEGORY_LABELS[category]}:</span>
          <span className="truncate font-medium">{current?.label ?? noneLabel ?? "+ Add"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[440px] p-2" align="start">
        <div className="mb-1.5 flex items-center justify-between px-0.5">
          <span className="text-xs font-semibold">{CATEGORY_LABELS[category]}</span>
          {noneLabel && (
            <button
              type="button"
              onClick={() => choose(null)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px]",
                value === null ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {noneLabel}
            </button>
          )}
        </div>
        <div className="grid max-h-[360px] grid-cols-4 gap-1.5 overflow-y-auto">
          {presets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              selected={preset.id === value}
              onSelect={() => choose(preset.id)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
