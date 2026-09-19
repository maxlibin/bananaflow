"use client";

import { createContext, useContext, useState } from "react";

interface MediaPanelContextValue {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const MediaPanelContext = createContext<MediaPanelContextValue | null>(null);

export function MediaPanelProvider({
  children,
  initialOpen = true,
}: {
  children: React.ReactNode;
  initialOpen?: boolean;
}) {
  const [isOpen, setOpen] = useState(initialOpen);
  return (
    <MediaPanelContext.Provider value={{ isOpen, setOpen }}>
      {children}
    </MediaPanelContext.Provider>
  );
}

export function useMediaPanel() {
  return (
    useContext(MediaPanelContext) ?? { isOpen: false, setOpen: () => {} }
  );
}
