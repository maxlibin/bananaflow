import path from "node:path";
import type { HostAdapter } from "../../lib/host/types";
import { createLocalDiskStorage } from "../../lib/storage/local-disk";
import { createS3Storage } from "../../lib/storage/s3";

export const UPLOADS_DIR = path.resolve(process.cwd(), "data", "uploads");
export const UPLOADS_PUBLIC_PATH = "/uploads";

class StorageConfigError extends Error {
  constructor(missing: string[]) {
    super(
      `S3 storage is partially configured. Missing: ${missing.join(", ")}. Set all S3_* variables or none to use local disk.`,
    );
    this.name = "StorageConfigError";
  }
}

// Local disk by default; S3-compatible storage when every S3_* variable is set.
export function createLocalStorage(appOrigin: string): HostAdapter["storage"] {
  const s3 = {
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_REGION: process.env.S3_REGION,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    S3_BUCKET: process.env.S3_BUCKET,
    S3_PUBLIC_BASE_URL: process.env.S3_PUBLIC_BASE_URL,
  };
  const provided = Object.entries(s3).filter(([, value]) => Boolean(value));
  if (provided.length === 0) {
    return createLocalDiskStorage({
      rootDir: UPLOADS_DIR,
      appOrigin,
      publicPath: UPLOADS_PUBLIC_PATH,
    });
  }
  const missing = Object.entries(s3)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) throw new StorageConfigError(missing);
  return createS3Storage({
    endpoint: s3.S3_ENDPOINT as string,
    region: s3.S3_REGION as string,
    accessKeyId: s3.S3_ACCESS_KEY_ID as string,
    secretAccessKey: s3.S3_SECRET_ACCESS_KEY as string,
    bucket: s3.S3_BUCKET as string,
    publicBaseUrl: s3.S3_PUBLIC_BASE_URL as string,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  });
}
