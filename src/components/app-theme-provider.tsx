"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";

const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Theme = "light" | "dark" | "system";
type Resolved = "light" | "dark";

export const THEME_COOKIE = "banana-theme";
const STORAGE_KEY = "banana-theme";
const ONE_YEAR = 60 * 60 * 24 * 365;

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: Resolved;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readSystem(): Resolved {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function writeCookie(resolved: Resolved) {
  if (typeof document === "undefined") return;
  document.cookie = `${THEME_COOKIE}=${resolved}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

interface AppThemeProviderProps {
  children: React.ReactNode;
  initialResolved?: Resolved;
}

export function AppThemeProvider({
  children,
  initialResolved = "light",
}: AppThemeProviderProps) {
  // Until we hydrate localStorage on mount, theme matches the cookie's
  // resolved value so SSR and first client paint stay aligned.
  const [theme, setThemeState] = useState<Theme>(initialResolved);
  const [system, setSystem] = useState<Resolved>(initialResolved);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && stored !== theme) {
      setThemeState(stored);
    }
    const sys = readSystem();
    setSystem(sys);
    // Sync cookie with current resolved theme so the next refresh has no flash.
    const currentResolved =
      (stored ?? theme) === "system" ? sys : ((stored ?? theme) as Resolved);
    writeCookie(currentResolved);

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = readSystem();
      setSystem(next);
      // If user is on "system" theme, keep cookie in sync with OS changes.
      const t =
        (window.localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
      if (t === "system") writeCookie(next);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    const resolved: Resolved = next === "system" ? readSystem() : next;
    writeCookie(resolved);
  }, []);

  const resolvedTheme: Resolved =
    theme === "system" ? system : (theme as Resolved);

  // Apply the dark class to <html> so portaled UI (Radix Dialog, Popover,
  // Toast, etc.) — which mounts under document.body, outside any wrapper —
  // also picks up the theme. Only runs while AppThemeProvider is mounted,
  // so public/marketing pages (which never mount this provider) keep their
  // hardcoded light styling regardless of the user's saved preference.
  useIsoLayoutEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    return () => {
      root.classList.remove("dark");
    };
  }, [resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

const noopTheme: ThemeContextValue = {
  theme: "light",
  resolvedTheme: "light",
  setTheme: () => {},
};

export function useTheme() {
  return useContext(ThemeContext) ?? noopTheme;
}
