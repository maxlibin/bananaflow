import { HardDrive } from "lucide-react";
import { AppLayout } from "../../components/app-shell/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { getAllBoards } from "../../host/actions";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const scaled = bytes / Math.pow(1024, index);
  return `${scaled.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export default async function StoragePage() {
  const result = await getAllBoards();
  const boards = result.success && result.boards ? result.boards : [];
  const totalBytes = boards.reduce((sum, board) => sum + (board.storageUsed ?? 0), 0);
  const sorted = [...boards].sort((a, b) => (b.storageUsed ?? 0) - (a.storageUsed ?? 0));

  return (
    <AppLayout title="Storage" description="Space used by uploads and generated media, per board.">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Total
          </CardTitle>
          <CardDescription>{formatBytes(totalBytes)} across {boards.length} boards</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {sorted.map((board) => (
              <li key={board.id} className="flex items-center justify-between py-2 text-sm">
                <span>{board.title}</span>
                <span className="text-muted-foreground">{formatBytes(board.storageUsed ?? 0)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
