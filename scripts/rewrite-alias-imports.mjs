// One-off codemod used when the package was split out of the SaaS repo:
// turns every `@/x` import under src/ into a relative path so the same
// files bundle correctly when another app installs this repo from git.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const src = path.join(root, "src");
const moved = new Map([
  ["components/dashboard-client", "components/dashboard/dashboard-client"],
  ["components/dashboard-empty-state", "components/dashboard/dashboard-empty-state"],
  ["components/board-card", "components/dashboard/board-card"],
  ["components/board-details-dialog", "components/dashboard/board-details-dialog"],
  ["components/create-board-dialog", "components/dashboard/create-board-dialog"],
  ["components/app-layout", "components/app-shell/app-layout"],
  ["components/app-sidebar", "components/app-shell/app-sidebar"],
]);
const exts = [".ts", ".tsx", ".js", ".mjs", ".css"];

function existsAsModule(base) {
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return true;
  for (const e of exts) if (fs.existsSync(base + e)) return true;
  for (const e of exts) if (fs.existsSync(path.join(base, "index" + e))) return true;
  return false;
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const unresolved = new Map();
let rewritten = 0;
for (const file of walk(src, [])) {
  const original = fs.readFileSync(file, "utf8");
  const updated = original.replace(/(["'])@\/([^"']+)\1/g, (match, quote, spec) => {
    const target = moved.get(spec) ?? spec;
    const absolute = path.join(src, target);
    if (!existsAsModule(absolute)) {
      unresolved.set(spec, [...(unresolved.get(spec) ?? []), path.relative(root, file)]);
      return match;
    }
    let rel = path.relative(path.dirname(file), absolute).split(path.sep).join("/");
    if (!rel.startsWith(".")) rel = "./" + rel;
    rewritten += 1;
    return `${quote}${rel}${quote}`;
  });
  if (updated !== original) fs.writeFileSync(file, updated);
}
console.log(`rewrote ${rewritten} imports`);
for (const [spec, files] of [...unresolved.entries()].sort()) {
  console.log(`UNRESOLVED @/${spec} <- ${files.length} file(s): ${files.slice(0, 3).join(", ")}${files.length > 3 ? " ..." : ""}`);
}
