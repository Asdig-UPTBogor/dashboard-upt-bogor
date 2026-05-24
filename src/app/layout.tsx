import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LayoutChrome } from "@/components/LayoutChrome";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Dashboard PLN UPT Bogor",
  description: "Transmission Monitoring System — PLN UPT Bogor",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning className="font-sans">
      <head />
      <body>
        <a href="#main-content" className="ds-skip-link">Skip to content</a>
        <ThemeProvider>
          <TooltipProvider>
            <LayoutChrome>{children}</LayoutChrome>
          </TooltipProvider>
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
