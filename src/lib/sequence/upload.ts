import type { DirectUpload } from "../host/types";

export class UploadFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadFailedError";
  }
}

export function putWithProgress(
  upload: DirectUpload,
  blob: Blob,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(upload.method, upload.uploadUrl);
    for (const [name, value] of Object.entries(upload.headers)) request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new UploadFailedError(`Upload failed with HTTP ${request.status}: ${request.responseText.slice(0, 300)}`));
    request.onerror = () => reject(new UploadFailedError("Upload failed: network error"));
    signal.addEventListener("abort", () => request.abort());
    request.onabort = () => reject(new DOMException("Export cancelled", "AbortError"));
    request.send(blob);
  });
}
