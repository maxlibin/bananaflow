"use client";

import { createContext, useContext, ReactNode } from "react";

interface ReadOnlyContextType {
  isReadOnly: boolean;
}

const ReadOnlyContext = createContext<ReadOnlyContextType>({
  isReadOnly: false,
});

interface ReadOnlyProviderProps {
  children: ReactNode;
  isReadOnly: boolean;
}

export function ReadOnlyProvider({
  children,
  isReadOnly,
}: ReadOnlyProviderProps) {
  return (
    <ReadOnlyContext.Provider value={{ isReadOnly }}>
      {children}
    </ReadOnlyContext.Provider>
  );
}

export function useReadOnly() {
  return useContext(ReadOnlyContext);
}
