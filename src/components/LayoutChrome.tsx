"use client";

import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

/**
 * Standard layout chrome — sidebar + header always present.
 * Untuk navigasi user antar route. JANGAN hide.
 */
export function LayoutChrome({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <AppHeader />
                <main id="main-content" className="flex-1 p-3 md:p-4 overflow-x-hidden">
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}
