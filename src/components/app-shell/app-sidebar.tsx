"use client";

import { FolderOpen, HardDrive, Home, KeyRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";
import { ThemeToggle } from "../theme-toggle";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Library", url: "/library", icon: FolderOpen },
  { title: "Storage", url: "/storage", icon: HardDrive },
  { title: "Settings", url: "/settings", icon: KeyRound },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-1 px-2 py-2">
          <div className="flex items-center justify-center overflow-hidden">
            <Image src="/logo.png" alt="Banana Flow" width={36} height={36} priority />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Banana Flow</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1">
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-medium">Local workspace</span>
            <span className="text-xs text-muted-foreground">Self-hosted Banana Flow</span>
          </div>
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
