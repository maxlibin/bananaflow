import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { ObjectStorage } from "./types";

export type S3StorageConfig = {
  // Full endpoint, e.g. https://<account>.r2.cloudflarestorage.com or https://s3.eu-west-1.amazonaws.com
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  // Public origin that serves the bucket, without a trailing slash.
  publicBaseUrl: string;
  // Path-style addressing is required by MinIO and some self-hosted gateways.
  forcePathStyle: boolean;
};

// Works with Cloudflare R2, AWS S3, MinIO and any S3-compatible gateway.
// Objects are written without an ACL; public read access is configured on
// the bucket, and `publicBaseUrl` is how the app links to them.
export function createS3Storage(config: S3StorageConfig): ObjectStorage {
  const publicBaseUrl = config.publicBaseUrl.replace(/\/$/, "");
  const publicHost = new URL(publicBaseUrl).hostname;
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return {
    async uploadAsset(input) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
        }),
      );
      return { url: `${publicBaseUrl}/${input.key}`, pathname: input.key };
    },
    isAllowedAssetUrl(url) {
      return url.hostname === publicHost;
    },
    resolveAssetUrl(url) {
      return url;
    },
  };
}
