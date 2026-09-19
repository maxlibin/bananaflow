import { SidebarInset, SidebarProvider, SidebarTrigger } from "../ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { AppThemeProvider } from "../app-theme-provider";
import { readThemeFromCookie } from "../../lib/theme-cookie";

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  description: string;
}

export async function AppLayout({ children, title, description }: AppLayoutProps) {
  const { resolved: initialResolved } = await readThemeFromCookie();

  return (
    <AppThemeProvider initialResolved={initialResolved}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-sidebar">
          <div className="flex flex-1 flex-col p-[7px]">
            <div className="w-full h-full p-6 border rounded-md bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
              <SidebarTrigger className="mb-6 px-0 mx-0 text-zinc-900 dark:text-zinc-100" />

              <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                  <h1 className="text-3xl font-bold mb-2">{title}</h1>
                  <p className="text-muted-foreground">{description}</p>
                </div>

                {children}
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AppThemeProvider>
  );
}
