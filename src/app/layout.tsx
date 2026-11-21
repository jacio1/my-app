import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import StoreProvider from "@/store/providers";
import { SyncStatus } from "@/components/sync-status";
import { ServiceWorker } from "@/components/service-worker";

export const metadata: Metadata = {
  title: "Мой дневник",
  description: "Личные задачи, заметки и дневник для саморефлексии",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Дневник" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#171620",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="dark h-full antialiased">
      <body className="flex h-dvh flex-col overflow-hidden">
        <StoreProvider>
          <ServiceWorker />
          <div className="flex min-h-0 flex-1">
            <Navigation />
            <main className="min-w-0 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-5xl px-4 py-6 md:px-10 md:py-10"><SyncStatus />{children}</div>
            </main>
          </div>
          <Navigation mobile />
        </StoreProvider>
      </body>
    </html>
  );
}
