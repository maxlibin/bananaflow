import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ObjectStorage } from "./types";
import { signUploadToken } from "./upload-token";

export type LocalDiskStorageConfig = {
  // Absolute directory that receives uploaded files.
  rootDir: string;
  // Origin of this app, e.g. http://localhost:3000. Used to recognise our
  // own asset URLs when they arrive in absolute form.
  appOrigin: string;
  // URL path under which `rootDir` is served, e.g. /uploads.
  publicPath: string;
  // Signs direct-upload tokens checked by src/app/api/uploads/[...key].
  uploadSecret: string;
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
  const appOrigin = config.appOrigin.replace(/\/$/, "");
  const appHost = new URL(appOrigin).host;

  const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");
  const assetUrl = (key: string) => `${publicPath}/${encodeKey(key)}`;

  return {
    async uploadAsset(input) {
      const target = resolveInsideRoot(rootDir, input.key);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, input.body);
      return { url: assetUrl(input.key), pathname: input.key };
    },
    assetUrl,
    async createUpload(input) {
      const token = signUploadToken(config.uploadSecret, {
        key: input.key,
        size: input.size,
        expiresAt: Date.now() + 10 * 60_000,
      });
      return {
        uploadUrl: `/api/uploads/${encodeKey(input.key)}?token=${token}`,
        method: "PUT",
        headers: { "Content-Type": input.contentType },
      };
    },
    async getAssetSize(key) {
      const info = await stat(resolveInsideRoot(rootDir, key)).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      return info ? info.size : null;
    },
    isAllowedAssetUrl(url) {
      return url.host === appHost && url.pathname.startsWith(`${publicPath}/`);
    },
    resolveAssetUrl(url) {
      return url.startsWith("/") ? `${appOrigin}${url}` : url;
    },
  };
}

export function resolveLocalAssetPath(rootDir: string, key: string): string {
  return resolveInsideRoot(path.resolve(rootDir), key);
}
