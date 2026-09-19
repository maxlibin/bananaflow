"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { X } from "lucide-react";
import NextImage from "next/image";
import { cn } from "../../lib/utils";

interface MediaLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: {
    type: "image" | "video";
    url: string;
    fileName?: string;
  } | null;
}

export function MediaLightbox({
  open,
  onOpenChange,
  media,
}: MediaLightboxProps) {
  if (!media) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-4 z-50 flex items-center justify-center",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
          onClick={() => onOpenChange(false)}
        >
          <VisuallyHidden>
            <DialogPrimitive.Title>
              {media.fileName || "Media preview"}
            </DialogPrimitive.Title>
          </VisuallyHidden>
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {media.type === "image" ? (
              <NextImage
                src={media.url}
                alt={media.fileName || "Media preview"}
                width={1200}
                height={800}
                className="max-h-[85vh] w-auto object-contain"
                priority
              />
            ) : (
              <video
                src={media.url}
                controls
                autoPlay
                className="max-h-[85vh] max-w-[90vw] rounded-lg"
              />
            )}

            {media.fileName && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                <p className="text-sm text-white truncate">{media.fileName}</p>
              </div>
            )}
          </div>

          <DialogPrimitive.Close
            className={cn(
              "absolute top-4 right-4 z-50",
              "flex h-10 w-10 items-center justify-center rounded-full",
              "bg-black/50 text-white hover:bg-black/70",
              "transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            )}
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

