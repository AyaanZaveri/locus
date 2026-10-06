import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";
import { LocusChat } from "@/components/locus-chat";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { getCompanyNavigation } from "@/lib/company-profile";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const companies = await getCompanyNavigation();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        geist.variable,
      )}
    >
      <body className="bg-sidebar">
        <ThemeProvider>
          <Toaster />
          <TooltipProvider>
            <SidebarProvider className="h-svh min-h-0 overflow-hidden bg-sidebar">
              <AppSidebar companies={companies} />
              <SidebarInset className="min-h-0 min-w-0 overflow-hidden shadow-none! ring-border/25 ring-1 [&>main]:overscroll-y-contain">
                {children}
              </SidebarInset>
              <LocusChat />
            </SidebarProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
