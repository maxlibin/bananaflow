import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ObjectStorage } from "./types";

export type LocalDiskStorageConfig = {
  // Absolute directory that receives uploaded files.
  rootDir: string;
  // Origin of this app, e.g. http://localhost:3000. Used to recognise our
  // own asset URLs when they arrive in absolute form.
  appOrigin: string;
  // URL path under which `rootDir` is served, e.g. /uploads.
  publicPath: string;
};

export class UnsafeStorageKeyError extends Error {
  constructor(key: string) {
    super(`Refusing to write storage key outside the upload root: ${key}`);
    this.name = "UnsafeStorageKeyError";
  }
}

function resolveInsideRoot(rootDir: string, key: string): string {
  const target = path.resolve(rootDir, key);
  const relative = path.relative(rootDir, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new UnsafeStorageKeyError(key);
  }
  return target;
}

// Stores uploads on the local filesystem and hands out app-relative URLs
// (`/uploads/<key>`). Relative URLs matter: the Next.js image optimizer
// refuses to fetch absolute URLs that resolve to a private address, but
// serves same-origin paths directly. The app serves `rootDir` under
// `publicPath` (see src/app/uploads/[...path]/route.ts).
export function createLocalDiskStorage(config: LocalDiskStorageConfig): ObjectStorage {
  const rootDir = path.resolve(config.rootDir);
  const publicPath = config.publicPath.replace(/\/$/, "");
  const appHost = new URL(config.appOrigin).host;

  return {
    async uploadAsset(input) {
      const target = resolveInsideRoot(rootDir, input.key);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, input.body);
      const encodedKey = input.key.split("/").map(encodeURIComponent).join("/");
      return { url: `${publicPath}/${encodedKey}`, pathname: input.key };
    },
    isAllowedAssetUrl(url) {
      return url.host === appHost && url.pathname.startsWith(`${publicPath}/`);
    },
  };
}

export function resolveLocalAssetPath(rootDir: string, key: string): string {
  return resolveInsideRoot(path.resolve(rootDir), key);
}
