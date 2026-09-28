"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, MapPin, Package, Sparkles, User } from "lucide-react";
import { Button } from "../ui/button";
import type { ScriptAssistant } from "../../lib/script/assistant";
import type { EntityKind, EntityNodeData } from "../../lib/script/types";

const KIND_ICONS: Record<EntityKind, typeof User> = {
  character: User,
  product: Package,
  location: MapPin,
};

export function ScriptCast({
  entities,
  assistant,
  readOnly,
  onFind,
  onAdd,
}: {
  entities: EntityNodeData[];
  assistant: ScriptAssistant | null;
  readOnly: boolean;
  onFind: () => Promise<void>;
  onAdd: (kind: EntityKind) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const find = async () => {
    setPending(true);
    setError(null);
    try {
      await onFind();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4" data-testid="script-cast">
      <p className="text-sm text-muted-foreground">
        Characters, products and locations that recur across shots. Each one feeds its reference
        images into every keyframe it appears in, so it looks the same from shot to shot. Edit
        looks and add references on the nodes left of the script.
      </p>
      {entities.length === 0 && (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          No cast or props yet.
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {entities.map((entity) => {
          const Icon = KIND_ICONS[entity.kind];
          return (
            <li key={`${entity.kind}-${entity.name}`} className="flex items-start gap-2 rounded-md border p-2.5 text-xs">
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fuchsia-500" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold uppercase">{entity.name}</div>
                <div className="text-muted-foreground">{entity.look || "No look described yet"}</div>
              </div>
              {entity.images.length === 0 ? (
                <span className="flex shrink-0 items-center gap-1 text-amber-600">
                  <AlertTriangle className="h-3 w-3" /> no references
                </span>
              ) : (
                <span className="shrink-0 text-muted-foreground">
                  {entity.images.length} ref{entity.images.length === 1 ? "" : "s"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {!readOnly && (
        <div className="flex flex-wrap gap-1.5">
          {assistant && (
            <Button size="sm" disabled={pending} onClick={() => void find()} data-testid="script-find-cast">
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Find cast & props in script
            </Button>
          )}
          {(["character", "product", "location"] as const).map((kind) => (
            <Button key={kind} size="sm" variant="outline" onClick={() => onAdd(kind)} className="capitalize">
              + {kind}
            </Button>
          ))}
        </div>
      )}
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}
