"use client";

import { useState } from "react";
import { createId } from "@paralleldrive/cuid2";
import { BoldIcon, ItalicIcon, Loader2, Sparkles, UnderlineIcon } from "lucide-react";
import type { TRange } from "platejs";
import {
  Plate,
  useEditorRef,
  useEditorSelector,
  usePlateEditor,
} from "platejs/react";
import { Editor, EditorContainer } from "../ui/editor";
import { FixedToolbar } from "../ui/fixed-toolbar";
import { FloatingToolbar } from "../ui/floating-toolbar";
import { RedoToolbarButton, UndoToolbarButton } from "../ui/history-toolbar-button";
import { MarkToolbarButton } from "../ui/mark-toolbar-button";
import { ScriptKit } from "./script-elements";
import type { ScriptAssistant } from "../../lib/script/assistant";
import { scriptToText } from "../../lib/script/scenes";
import { SCRIPT_BLOCK_TYPES, type ScriptBlock, type ScriptDoc } from "../../lib/script/types";
import { cn } from "../../lib/utils";

const BLOCK_BUTTONS = [
  {
    type: SCRIPT_BLOCK_TYPES.scene,
    label: "Scene",
    tooltip: "Scene heading (starts a new scene)",
    idle: "border-indigo-500/30 text-indigo-600 dark:text-indigo-400",
    active: "border-indigo-500 bg-indigo-500 text-white",
  },
  {
    type: SCRIPT_BLOCK_TYPES.action,
    label: "Visual",
    tooltip: "What we see",
    idle: "border-border text-muted-foreground",
    active: "border-foreground bg-foreground text-background",
  },
  {
    type: SCRIPT_BLOCK_TYPES.voiceover,
    label: "VO",
    tooltip: "Voiceover",
    idle: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
    active: "border-emerald-500 bg-emerald-500 text-white",
  },
  {
    type: SCRIPT_BLOCK_TYPES.dialogue,
    label: "Dialogue",
    tooltip: "A character speaks on camera",
    idle: "border-sky-500/30 text-sky-600 dark:text-sky-400",
    active: "border-sky-500 bg-sky-500 text-white",
  },
  {
    type: SCRIPT_BLOCK_TYPES.onscreen,
    label: "On-screen",
    tooltip: "Text shown on screen",
    idle: "border-amber-500/30 text-amber-600 dark:text-amber-400",
    active: "border-amber-500 bg-amber-500 text-white",
  },
] as const;

const EDIT_ACTIONS = [
  "Punch it up: more vivid, specific and scroll-stopping",
  "Make it shorter and tighter",
  "Make it more emotional",
  "Use simpler, conversational words",
  "Make it more visual: describe what the camera sees",
] as const;

function BlockTypeButtons() {
  const editor = useEditorRef();
  const currentType = useEditorSelector(
    (ed) => ed.api.block()?.[0]?.type as string | undefined,
    [],
  );
  return (
    <div className="flex items-center gap-1">
      {BLOCK_BUTTONS.map((button) => (
        <button
          key={button.type}
          type="button"
          title={button.tooltip}
          aria-pressed={currentType === button.type}
          data-testid={`script-block-${button.type}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const props: Partial<ScriptBlock> = { type: button.type };
            if (button.type === SCRIPT_BLOCK_TYPES.scene) {
              props.sceneId = createId();
            }
            if (button.type === SCRIPT_BLOCK_TYPES.dialogue) {
              props.character = "";
            }
            editor.tf.setNodes(props);
            editor.tf.focus();
          }}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
            currentType === button.type ? button.active : cn(button.idle, "hover:bg-muted"),
          )}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}

function AiEditMenu({ assistant }: { assistant: ScriptAssistant }) {
  const editor = useEditorRef();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (instruction: string) => {
    const selection = editor.selection as TRange | null;
    if (!selection) {
      throw new Error("Select some script text before running an AI edit");
    }
    const selectedText = editor.api.string(selection);
    setPending(instruction);
    setError(null);
    try {
      const replacement = await assistant.editSelection({
        instruction,
        selectedText,
        scriptText: scriptToText(editor.children as unknown as ScriptDoc),
      });
      editor.tf.select(selection);
      editor.tf.insertText(replacement);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(null);
    }
  };

  return (
    <FloatingToolbar>
      <div className="flex flex-col gap-1 p-1 max-w-[320px]">
        <div className="flex items-center gap-1 px-1 text-[11px] font-medium text-muted-foreground">
          <Sparkles className="h-3 w-3" /> Improve selection
        </div>
        {EDIT_ACTIONS.map((instruction) => (
          <button
            key={instruction}
            type="button"
            disabled={pending !== null}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void run(instruction)}
            className="flex items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-muted disabled:opacity-50"
          >
            {pending === instruction && <Loader2 className="h-3 w-3 animate-spin" />}
            {instruction.split(":")[0]}
          </button>
        ))}
        {error && <div className="px-2 text-[11px] text-red-600">{error}</div>}
      </div>
    </FloatingToolbar>
  );
}

export function ScriptEditor({
  initialDoc,
  onChange,
  assistant,
  readOnly,
}: {
  initialDoc: ScriptDoc;
  onChange: (doc: ScriptDoc) => void;
  assistant: ScriptAssistant | null;
  readOnly: boolean;
}) {
  const editor = usePlateEditor({
    plugins: ScriptKit,
    value: initialDoc as unknown as NonNullable<Parameters<typeof usePlateEditor>[0]>["value"],
  });

  return (
    <Plate
      editor={editor}
      readOnly={readOnly}
      onValueChange={({ value }) => onChange(value as unknown as ScriptDoc)}
    >
      {!readOnly && (
        <FixedToolbar className="justify-start gap-3 rounded-t-md border-b px-3 py-1.5">
          <BlockTypeButtons />
          <div className="flex items-center">
            <MarkToolbarButton nodeType="bold" tooltip="Bold (⌘B)">
              <BoldIcon />
            </MarkToolbarButton>
            <MarkToolbarButton nodeType="italic" tooltip="Italic (⌘I)">
              <ItalicIcon />
            </MarkToolbarButton>
            <MarkToolbarButton nodeType="underline" tooltip="Underline (⌘U)">
              <UnderlineIcon />
            </MarkToolbarButton>
          </div>
          <div className="flex items-center">
            <UndoToolbarButton />
            <RedoToolbarButton />
          </div>
        </FixedToolbar>
      )}
      <EditorContainer className="min-h-0 flex-1">
        <Editor
          variant="none"
          className="px-4 pt-4 pb-40 text-sm"
          placeholder="Write your script. Start a scene with the Scene button."
        />
      </EditorContainer>
      {!readOnly && assistant && <AiEditMenu assistant={assistant} />}
    </Plate>
  );
}
