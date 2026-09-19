import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ObjectStorage } from "./types";

export type LocalDiskStorageConfig = {
  // Absolute directory that receives uploaded files.
  rootDir: string;
  // Origin of this app, e.g. http://localhost:3000, used to build asset URLs.
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

// Stores uploads on the local filesystem. The app serves `rootDir` under
// `publicPath` (see src/app/uploads/[...path]/route.ts in the open-source app).
export function createLocalDiskStorage(config: LocalDiskStorageConfig): ObjectStorage {
  const rootDir = path.resolve(config.rootDir);
  const appOrigin = config.appOrigin.replace(/\/$/, "");
  const publicPath = config.publicPath.replace(/\/$/, "");
  const appHost = new URL(appOrigin).hostname;

  return {
    async uploadAsset(input) {
      const target = resolveInsideRoot(rootDir, input.key);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, input.body);
      const encodedKey = input.key.split("/").map(encodeURIComponent).join("/");
      return { url: `${appOrigin}${publicPath}/${encodedKey}`, pathname: input.key };
    },
    isAllowedAssetUrl(url) {
      return url.hostname === appHost && url.pathname.startsWith(`${publicPath}/`);
    },
  };
}

export function resolveLocalAssetPath(rootDir: string, key: string): string {
  return resolveInsideRoot(path.resolve(rootDir), key);
}
