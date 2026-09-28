"use client";

import { memo, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import NextImage from "next/image";
import { ImagePlus, Loader2, MapPin, Package, Sparkles, Upload, User, X } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Textarea } from "../../ui/textarea";
import { NodeBox } from "./node-box";
import { useReadOnly } from "../readonly-context";
import { useCanvasHost } from "../../canvas-host/context";
import { useBoardStore, entityValue } from "../../../stores/board-store";
import { uploadBoardImage, type BoardImage } from "../upload-board-image";
import { collectBoardMedia } from "../../../lib/board-media";
import { ENTITY_KINDS, type EntityKind, type EntityNodeData } from "../../../lib/script/types";

const KIND_ICONS: Record<EntityKind, typeof User> = {
  character: User,
  product: Package,
  location: MapPin,
};

const SHEET_PROMPTS: Record<EntityKind, (name: string, look: string) => string> = {
  character: (name, look) =>
    `Character reference sheet of ${name}: ${look}. Full-body front view, three-quarter view and side profile, plus a close-up of the face. Neutral light grey studio background, soft even lighting, the same person with a consistent identity in every view, no text or labels.`,
  product: (name, look) =>
    `Product reference sheet of ${name}: ${look}. The same product shown from the front, back, side and a three-quarter angle on a clean white background, accurate shape, colors, materials and label, soft studio lighting, no extra text.`,
  location: (name, look) =>
    `Location reference of ${name}: ${look}. One wide establishing view and two closer angles of the same place, consistent layout, lighting and materials, no people, no text.`,
};

const ACCEPTED_TYPES = {
  "image/*": [".jpeg", ".jpg", ".png", ".webp"],
};

interface EntityNodeProps {
  id: string;
  data: EntityNodeData & {
    onDelete?: (nodeId: string) => void;
    result?: { status?: string; error?: string; imageUrl?: string };
  };
  isConnectable?: boolean;
  selected?: boolean;
}

const EntityNode = memo(({ id, data, isConnectable, selected }: EntityNodeProps) => {
  const canvasHost = useCanvasHost();
  const { isReadOnly } = useReadOnly();
  const boardId = useBoardStore((state) => state.boardId);
  const updateNodeData = useBoardStore((state) => state.updateNodeData);
  const generateImage = useBoardStore((state) => state.generateImage);
  const nodes = useBoardStore((state) => state.nodes);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetModel, setSheetModel] = useState(canvasHost.models.referenceImageModel);

  const Icon = KIND_ICONS[data.kind];
  const isGenerating = data.result?.status === "generating";
  const sheetCost = canvasHost.costPreview({ kind: "image", model: sheetModel, count: 1 });
  const boardImages = collectBoardMedia(nodes).filter(
    (item) => item.type === "image" && !data.images.some((image) => image.imageUrl === item.url),
  );

  const update = (patch: Partial<EntityNodeData>) => {
    const next = { ...data, ...patch };
    updateNodeData(id, { ...patch, label: next.name, value: entityValue(next.name, next.look) });
  };

  const addImages = (added: BoardImage[]) => update({ images: [...data.images, ...added] });

  // A finished reference sheet joins the references once; removing it later
  // does not bring it back.
  useEffect(() => {
    const sheetUrl = data.result?.status === "completed" ? data.result.imageUrl : undefined;
    if (!sheetUrl || sheetUrl === data.lastSheetUrl) return;
    updateNodeData(id, {
      lastSheetUrl: sheetUrl,
      images: [...data.images, { imageUrl: sheetUrl, fileName: `${data.name} reference sheet` }],
    });
  }, [id, data.result, data.lastSheetUrl, data.images, data.name, updateNodeData]);

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    accept: ACCEPTED_TYPES,
    noClick: true,
    noKeyboard: true,
    disabled: isReadOnly,
    multiple: true,
    onDrop: async (files: File[]) => {
      setIsUploading(true);
      setError(null);
      try {
        const uploaded = await Promise.all(
          files.map((file) =>
            uploadBoardImage({ file, boardId, onLimit: canvasHost.onLimit }),
          ),
        );
        addImages(uploaded);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setIsUploading(false);
      }
    },
  });

  const generateSheet = () =>
    void generateImage(id, {
      prompt: SHEET_PROMPTS[data.kind](data.name, data.look),
      images: data.images.map((image) => ({ nodeId: id, ...image })),
      model: sheetModel,
      settings: { aspectRatio: "16:9" } as never,
    });

  return (
    <NodeBox
      id={id}
      title={data.name || "Entity"}
      icon={<Icon className="h-4 w-4 text-fuchsia-500" />}
      nodeType="entityNode"
      onDelete={data.onDelete}
      isConnectable={isConnectable}
      selected={selected}
    >
      <div {...getRootProps()} className="flex w-[280px] flex-col gap-1.5" data-testid="entity-node">
        <input {...getInputProps()} />
        <div className="grid grid-cols-[96px_1fr] gap-1">
          <select
            value={data.kind}
            disabled={isReadOnly}
            onChange={(event) => update({ kind: event.target.value as EntityKind })}
            className="nodrag h-7 rounded-md border bg-transparent px-1 text-xs capitalize"
            aria-label="Entity kind"
          >
            {ENTITY_KINDS.map((kind) => (
              <option key={kind} value={kind}>{kind}</option>
            ))}
          </select>
          <Input
            value={data.name}
            disabled={isReadOnly}
            onChange={(event) => update({ name: event.target.value })}
            className="nodrag h-7 text-xs font-semibold uppercase"
            aria-label="Name"
          />
        </div>
        <Textarea
          value={data.look}
          disabled={isReadOnly}
          rows={2}
          placeholder="Look: 30s woman, short dark hair, grey crewneck sweatshirt"
          onChange={(event) => update({ look: event.target.value })}
          className="nodrag nowheel min-h-0 resize-none text-xs"
          aria-label="Look"
        />
        <div className={`flex flex-wrap gap-1.5 rounded ${isDragActive ? "bg-fuchsia-50 dark:bg-fuchsia-950/30" : ""}`}>
          {data.images.map((image, index) => (
            <div key={`${image.imageUrl}-${index}`} className="group/thumb relative h-14 w-14 overflow-hidden rounded border bg-muted">
              <NextImage src={image.imageUrl} alt={image.fileName ?? data.name} fill sizes="56px" className="object-cover" />
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => update({ images: data.images.filter((_, i) => i !== index) })}
                  className="absolute right-0 top-0 rounded-full bg-background/60 p-0.5 opacity-0 group-hover/thumb:opacity-100"
                  aria-label="Remove reference"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          {data.images.length === 0 && (
            <div className="text-[11px] text-muted-foreground">
              No references yet. Add photos or generate a reference sheet so every shot matches.
            </div>
          )}
        </div>
        {!isReadOnly && (
          <div className="flex flex-wrap gap-1">
            <Button type="button" variant="outline" size="sm" className="nodrag h-7 px-2 text-[11px]" onClick={open} disabled={isUploading}>
              {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Upload
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="nodrag h-7 px-2 text-[11px]" disabled={boardImages.length === 0}>
                  <ImagePlus className="h-3 w-3" /> From board
                </Button>
              </PopoverTrigger>
              <PopoverContent className="grid w-64 grid-cols-4 gap-1.5 p-2">
                {boardImages.map((item) => (
                  <button
                    key={item.url}
                    type="button"
                    onClick={() => addImages([{ imageUrl: item.url, fileName: item.fileName }])}
                    className="relative aspect-square overflow-hidden rounded border hover:ring-2 hover:ring-primary/40"
                  >
                    <NextImage src={item.url} alt={item.fileName ?? "Board image"} fill sizes="56px" className="object-cover" />
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        )}
        {!isReadOnly && (
          <div className="flex items-center gap-1">
            <select
              value={sheetModel}
              onChange={(event) => setSheetModel(event.target.value)}
              className="nodrag h-7 min-w-0 flex-1 rounded-md border bg-transparent px-1 text-[11px]"
              aria-label="Reference sheet model"
            >
              {canvasHost.models.image.map((model) => (
                <option key={model.value} value={model.value}>{model.label}</option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              className="nodrag h-7 shrink-0 px-2 text-[11px]"
              disabled={isGenerating || !data.look.trim()}
              onClick={generateSheet}
              data-testid="entity-generate-sheet"
            >
              {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Reference sheet{sheetCost ? ` · ${Math.ceil(sheetCost.credits)} cr` : ""}
            </Button>
          </div>
        )}
        {(error || data.result?.error) && (
          <div className="text-[11px] text-red-600">{error ?? data.result?.error}</div>
        )}
      </div>
    </NodeBox>
  );
});

EntityNode.displayName = "EntityNode";

export default EntityNode;
