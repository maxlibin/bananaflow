"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";

export function SequencePanel({
  nodeId,
  open,
  onOpenChange,
}: {
  nodeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[720px] max-w-full" data-testid={`sequence-panel-${nodeId}`}>
        <SheetHeader>
          <SheetTitle>Sequence</SheetTitle>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
}
