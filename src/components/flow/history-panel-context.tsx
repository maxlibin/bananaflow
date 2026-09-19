"use client";

import { createContext, useContext, useState } from "react";

interface HistoryPanelContextValue {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const HistoryPanelContext = createContext<HistoryPanelContextValue | null>(
  null,
);

export function HistoryPanelProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setOpen] = useState(false);
  return (
    <HistoryPanelContext.Provider value={{ isOpen, setOpen }}>
      {children}
    </HistoryPanelContext.Provider>
  );
}

export function useHistoryPanel() {
  return (
    useContext(HistoryPanelContext) ?? { isOpen: false, setOpen: () => {} }
  );
}
