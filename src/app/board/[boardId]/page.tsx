import type { Edge, Node as FlowNode } from "@xyflow/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AppSidebar } from "../../../components/app-shell/app-sidebar";
import { AppThemeProvider } from "../../../components/app-theme-provider";
import { FlowCanvas } from "../../../components/flow";
import { BoardTabs } from "../../../components/flow/board-tabs";
import { BoardTabsBootstrap } from "../../../components/flow/board-tabs-bootstrap";
import { HistoryPanelProvider } from "../../../components/flow/history-panel-context";
import { MediaPanelProvider } from "../../../components/flow/media-panel-context";
import { Button } from "../../../components/ui/button";
import { SidebarInset, SidebarProvider } from "../../../components/ui/sidebar";
import { getBoard, getOpenTabs, getTabLimit } from "../../../host/actions";
import { readThemeFromCookie } from "../../../lib/theme-cookie";
import { BoardStoreProvider } from "../../../stores/board-store";
import { BoardPageClient } from "./board-page-client";

interface BoardPageProps {
  params: Promise<{ boardId: string }>;
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { boardId } = await params;
  const [result, themeFromCookie, openTabs, tabLimit] = await Promise.all([
    getBoard(boardId),
    readThemeFromCookie(),
    getOpenTabs(),
    getTabLimit(),
  ]);

  if (!result.success || !result.board) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Board Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The board with ID &quot;{boardId}&quot; could not be found.
          </p>
          <Button asChild>
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const initialNodes = (result.board.nodes ?? []) as FlowNode[];
  const initialEdges = (result.board.edges ?? []) as Edge[];

  return (
    <AppThemeProvider initialResolved={themeFromCookie.resolved}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-sidebar">
          <div className="flex flex-1 flex-col p-[7px]">
            <MediaPanelProvider>
              <HistoryPanelProvider>
                <BoardTabsBootstrap
                  initialTabs={openTabs}
                  currentBoard={{ id: result.board.id, title: result.board.title }}
                  tabLimit={tabLimit}
                />
                <div className="flex items-center pb-1">
                  <BoardTabs />
                </div>
                <div className="w-full h-full border rounded-md bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 relative">
                  <BoardPageClient />
                  <BoardStoreProvider
                    boardId={boardId}
                    initialNodes={initialNodes}
                    initialEdges={initialEdges}
                  >
                    <FlowCanvas />
                  </BoardStoreProvider>
                </div>
              </HistoryPanelProvider>
            </MediaPanelProvider>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AppThemeProvider>
  );
}
