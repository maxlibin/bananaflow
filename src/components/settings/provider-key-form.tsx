"use client";

import { useState, useTransition } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import type { ProviderId } from "../../lib/providers/types";
import type { SaveKeyResult } from "../../app/settings/actions";

type ProviderKeyFormProps = {
  provider: ProviderId;
  label: string;
  helpUrl: string;
  lastFour: string | null;
  onSave: (provider: ProviderId, plaintext: string) => Promise<SaveKeyResult>;
  onClear: (provider: ProviderId) => Promise<SaveKeyResult>;
  onTest: (provider: ProviderId, plaintext: string) => Promise<SaveKeyResult>;
};

export function ProviderKeyForm({
  provider,
  label,
  helpUrl,
  lastFour,
  onSave,
  onClear,
  onTest,
}: ProviderKeyFormProps) {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (work: () => Promise<SaveKeyResult>, okText: string) => {
    setMessage(null);
    startTransition(async () => {
      const result = await work();
      if (result.success) {
        setMessage({ tone: "ok", text: okText });
        setValue("");
      } else {
        setMessage({ tone: "error", text: result.error });
      }
    });
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">{label}</h2>
          <p className="text-sm text-muted-foreground">
            {lastFour ? `Saved key ending in …${lastFour}` : "No key saved"}
            {" · "}
            <a className="underline" href={helpUrl} target="_blank" rel="noreferrer">
              Get a key
            </a>
          </p>
        </div>
        {lastFour ? (
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            data-testid={`clear-key-${provider}`}
            onClick={() => run(() => onClear(provider), "Key removed")}
          >
            Remove
          </Button>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`key-${provider}`}>API key</Label>
        <Input
          id={`key-${provider}`}
          data-testid={`key-input-${provider}`}
          type="password"
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Paste your key"
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={isPending || value.trim().length === 0}
          data-testid={`save-key-${provider}`}
          onClick={() => run(() => onSave(provider, value), "Key verified and saved")}
        >
          Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending || value.trim().length === 0}
          data-testid={`test-key-${provider}`}
          onClick={() => run(() => onTest(provider, value), "Key works")}
        >
          Test key
        </Button>
      </div>
      {message ? (
        <p
          data-testid={`key-message-${provider}`}
          className={message.tone === "ok" ? "text-sm text-emerald-600" : "text-sm text-destructive"}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
