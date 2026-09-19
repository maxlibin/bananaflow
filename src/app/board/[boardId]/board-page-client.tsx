"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { SidebarTrigger } from "../../../components/ui/sidebar";
import { useHistoryPanel } from "../../../components/flow/history-panel-context";
import { useMediaPanel } from "../../../components/flow/media-panel-context";

export function BoardPageClient() {
  const router = useRouter();
  const { isOpen: mediaOpen } = useMediaPanel();
  const { isOpen: historyOpen } = useHistoryPanel();
  const rightOffset = historyOpen ? "right-[25rem]" : mediaOpen ? "right-[19rem]" : "right-4";

  return (
    <>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <SidebarTrigger className="-ml-1 cursor-pointer" />
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Dashboard
        </Button>
      </div>
      <div className={`absolute top-4 z-30 ${rightOffset}`} />
    </>
  );
}
