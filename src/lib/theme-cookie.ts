import { cookies } from "next/headers";
import { THEME_COOKIE } from "../components/app-theme-provider";

export type Resolved = "light" | "dark";

export async function readThemeFromCookie(): Promise<{
  resolved: Resolved;
}> {
  const store = await cookies();
  const value = store.get(THEME_COOKIE)?.value;
  const resolved: Resolved = value === "dark" ? "dark" : "light";
  return { resolved };
}
