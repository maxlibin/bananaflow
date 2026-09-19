import { AppLayout } from "../../components/app-shell/app-layout";
import { DashboardClient } from "../../components/dashboard/dashboard-client";
import { DashboardEmptyState } from "../../components/dashboard/dashboard-empty-state";
import { getAllBoards } from "../../host/actions";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const boardsResult = await getAllBoards();
  const boards = boardsResult.success && boardsResult.boards ? boardsResult.boards : [];
  const isEmpty = boards.length === 0;

  return (
    <AppLayout
      title={isEmpty ? "Make your first AI workflow" : "Your Boards"}
      description={
        isEmpty
          ? "Generate images and videos by wiring up prompts on a visual canvas."
          : "Create and manage your flow boards. Each board is a separate workspace for your flows."
      }
    >
      {isEmpty ? <DashboardEmptyState /> : <DashboardClient initialBoards={boards} />}
    </AppLayout>
  );
}
