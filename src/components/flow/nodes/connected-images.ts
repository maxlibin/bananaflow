export type ConnectedImage = {
  nodeId: string;
  imageUrl: string;
  fileName?: string;
  blobPath?: string;
  fileSize?: number;
};

// Output and video nodes take images through two handles ("images" and
// "input"). Each handle keeps its own list so an update on one never drops the
// other's images; generation uses both, "images" first, without duplicates.
export function mergeConnectedImages(
  fromImagesHandle: ConnectedImage[],
  fromInputHandle: ConnectedImage[],
): ConnectedImage[] {
  const seen = new Set<string>();
  return [...fromImagesHandle, ...fromInputHandle].filter((image) => {
    if (seen.has(image.imageUrl)) return false;
    seen.add(image.imageUrl);
    return true;
  });
}
