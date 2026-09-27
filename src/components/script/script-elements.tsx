"use client";

import type { ReactNode } from "react";
import {
  BoldRules,
  ItalicRules,
  UnderlineRules,
} from "@platejs/basic-nodes";
import {
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
} from "@platejs/basic-nodes/react";
import {
  createPlatePlugin,
  ParagraphPlugin,
  PlateElement,
  useEditorRef,
  type PlateElementProps,
} from "platejs/react";
import { ParagraphElement } from "../ui/paragraph-node";
import { SCRIPT_BLOCK_TYPES, type ScriptBlock } from "../../lib/script/types";
import { cn } from "../../lib/utils";

function Gutter({ label, className }: { label: string; className: string }) {
  return (
    <span
      contentEditable={false}
      className={cn(
        "absolute left-0 top-1.5 w-20 select-none text-[10px] font-semibold uppercase tracking-wide",
        className,
      )}
    >
      {label}
    </span>
  );
}

function LineElement({
  props,
  label,
  gutterClassName,
  children,
}: {
  props: PlateElementProps;
  label: string;
  gutterClassName: string;
  children: ReactNode;
}) {
  return (
    <PlateElement {...props} className="relative py-1 pl-24">
      <Gutter label={label} className={gutterClassName} />
      {children}
    </PlateElement>
  );
}

function SceneElement(props: PlateElementProps) {
  const element = props.element as unknown as ScriptBlock;
  return (
    <PlateElement
      {...props}
      className="relative mt-6 border-t pt-3 pl-24 text-sm font-bold uppercase tracking-wide first:mt-0 first:border-t-0"
    >
      <Gutter
        label={typeof element.seconds === "number" ? `Scene · ${element.seconds}s` : "Scene"}
        className="top-3.5 text-indigo-500"
      />
      {props.children}
    </PlateElement>
  );
}

function ActionElement(props: PlateElementProps) {
  return (
    <LineElement props={props} label="Visual" gutterClassName="text-muted-foreground">
      {props.children}
    </LineElement>
  );
}

function VoiceoverElement(props: PlateElementProps) {
  return (
    <LineElement props={props} label="VO" gutterClassName="text-emerald-600">
      <span className="italic">{props.children}</span>
    </LineElement>
  );
}

function DialogueElement(props: PlateElementProps) {
  const editor = useEditorRef();
  const element = props.element as unknown as ScriptBlock;
  return (
    <PlateElement {...props} className="relative py-1 pl-24">
      <span contentEditable={false} className="absolute left-0 top-1 w-20 select-none">
        <input
          value={element.character ?? ""}
          placeholder="WHO"
          aria-label="Character name"
          onChange={(event) => {
            const path = editor.api.findPath(props.element);
            if (!path) {
              throw new Error("Dialogue block is no longer in the script");
            }
            editor.tf.setNodes(
              { character: event.target.value.toUpperCase() },
              { at: path },
            );
          }}
          className="w-full bg-transparent text-[10px] font-semibold uppercase tracking-wide text-sky-600 outline-none placeholder:text-sky-600/50"
        />
      </span>
      {props.children}
    </PlateElement>
  );
}

function OnScreenElement(props: PlateElementProps) {
  return (
    <LineElement props={props} label="On-screen" gutterClassName="text-amber-600">
      <span className="font-medium">{props.children}</span>
    </LineElement>
  );
}

const scenePlugin = createPlatePlugin({
  key: SCRIPT_BLOCK_TYPES.scene,
  node: { isElement: true, component: SceneElement },
  rules: { break: { splitReset: true } },
});

const actionPlugin = createPlatePlugin({
  key: SCRIPT_BLOCK_TYPES.action,
  node: { isElement: true, component: ActionElement },
});

const voiceoverPlugin = createPlatePlugin({
  key: SCRIPT_BLOCK_TYPES.voiceover,
  node: { isElement: true, component: VoiceoverElement },
});

const dialoguePlugin = createPlatePlugin({
  key: SCRIPT_BLOCK_TYPES.dialogue,
  node: { isElement: true, component: DialogueElement },
});

const onscreenPlugin = createPlatePlugin({
  key: SCRIPT_BLOCK_TYPES.onscreen,
  node: { isElement: true, component: OnScreenElement },
});

export const ScriptKit = [
  ParagraphPlugin.withComponent(ParagraphElement),
  scenePlugin,
  actionPlugin,
  voiceoverPlugin,
  dialoguePlugin,
  onscreenPlugin,
  BoldPlugin.configure({ inputRules: [BoldRules.markdown({ variant: "*" })] }),
  ItalicPlugin.configure({ inputRules: [ItalicRules.markdown({ variant: "_" })] }),
  UnderlinePlugin.configure({ inputRules: [UnderlineRules.markdown()] }),
];
