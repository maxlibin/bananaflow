import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const TARGET_FILES = [
  "node_modules/react-filerobot-image-editor/lib/components/Tabs/TabsResponsive.js",
  "node_modules/react-filerobot-image-editor/lib/components/buttons/HistoryButtons/UndoButton.js",
  "node_modules/react-filerobot-image-editor/lib/components/buttons/HistoryButtons/RedoButton.js",
  "node_modules/react-filerobot-image-editor/lib/components/tools/ObjectRemoval/ObjectRemovalBrushMode.js",
  "node_modules/react-filerobot-image-editor/lib/components/tools/ObjectRemoval/ObjectRemovalBrushType.js",
  "node_modules/react-filerobot-image-editor/lib/components/tools/ObjectRemoval/ObjectRemovalBrushSize.js",
];

const reactImport = 'import React from"react";';
let patchedCount = 0;
let missingCount = 0;

for (const relativeFilePath of TARGET_FILES) {
  const absoluteFilePath = resolve(process.cwd(), relativeFilePath);

  if (!existsSync(absoluteFilePath)) {
    missingCount += 1;
    continue;
  }

  const source = readFileSync(absoluteFilePath, "utf8");
  // Skip files that already bind `React` from any import form
  // (`import React from`, `import React,{...}from`, `import React,{ ... } from`).
  if (/import\s+React\b/.test(source)) {
    continue;
  }

  writeFileSync(absoluteFilePath, `${reactImport}${source}`);
  patchedCount += 1;
}

if (patchedCount > 0 || missingCount > 0) {
  console.log(
    `[patch-filerobot-react-imports] patched=${patchedCount} missing=${missingCount}`,
  );
}
