"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { MigrationNoticeGate } from "@/components/MigrationNotice";

/**
 * Standard layout chrome — sidebar + header always present.
 * Untuk navigasi user antar route. JANGAN hide.
 * Pengecualian: route full-bleed (mis. /wap-infografis) render tanpa chrome.
 */
const FULLBLEED_PREFIXES = ["/wap-infografis"];

export function LayoutChrome({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    if (pathname && FULLBLEED_PREFIXES.some((p) => pathname.startsWith(p))) {
        return <>{children}</>;
    }
    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <AppHeader />
                <main id="main-content" className="flex-1 p-3 md:p-4 overflow-x-hidden">
                    <MigrationNoticeGate />
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}
