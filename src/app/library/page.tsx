import { AppLayout } from "../../components/app-shell/app-layout";
import { MediaLibraryClient } from "../../components/media-library-client";
import { getAllMedia } from "../../host/actions";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const result = await getAllMedia();
  const media = result.success && result.media ? result.media : [];

  return (
    <AppLayout
      title="Media Library"
      description="Browse and manage all your generated and uploaded media files."
    >
      <MediaLibraryClient initialMedia={media} />
    </AppLayout>
  );
}
