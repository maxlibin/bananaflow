"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";

type DialogKind = "notify" | "confirm";

interface DialogState {
  open: boolean;
  kind: DialogKind;
  title: string;
  description?: string;
  confirmText: string;
  cancelText: string;
  destructive: boolean;
  resolve?: (value: boolean) => void;
}

interface DialogStore extends DialogState {
  show: (next: Partial<DialogState> & { kind: DialogKind }) => void;
  resolveAndClose: (value: boolean) => void;
}

const useDialogStore = create<DialogStore>((set, get) => ({
  open: false,
  kind: "notify",
  title: "",
  description: undefined,
  confirmText: "OK",
  cancelText: "Cancel",
  destructive: false,
  resolve: undefined,
  show: (next) =>
    set({
      open: true,
      title: "",
      description: undefined,
      confirmText: next.kind === "confirm" ? "Continue" : "OK",
      cancelText: "Cancel",
      destructive: false,
      ...next,
    }),
  resolveAndClose: (value) => {
    const { resolve } = get();
    resolve?.(value);
    set({ open: false, resolve: undefined });
  },
}));

interface NotifyOptions {
  title: string;
  description?: string;
  confirmText?: string;
}

interface ConfirmOptions extends NotifyOptions {
  cancelText?: string;
  destructive?: boolean;
}

export function notifyDialog(options: NotifyOptions): Promise<void> {
  return new Promise((resolve) => {
    useDialogStore.getState().show({
      kind: "notify",
      title: options.title,
      description: options.description,
      confirmText: options.confirmText ?? "OK",
      resolve: () => resolve(),
    });
  });
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useDialogStore.getState().show({
      kind: "confirm",
      title: options.title,
      description: options.description,
      confirmText: options.confirmText ?? "Continue",
      cancelText: options.cancelText ?? "Cancel",
      destructive: options.destructive ?? false,
      resolve,
    });
  });
}

export function DialogHost() {
  const state = useDialogStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const onOpenChange = (next: boolean) => {
    if (!next) state.resolveAndClose(false);
  };

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          {state.description ? (
            <DialogDescription>{state.description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <DialogFooter>
          {state.kind === "confirm" && (
            <Button
              variant="outline"
              onClick={() => state.resolveAndClose(false)}
            >
              {state.cancelText}
            </Button>
          )}
          <Button
            variant={state.destructive ? "destructive" : "default"}
            onClick={() => state.resolveAndClose(true)}
          >
            {state.confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
