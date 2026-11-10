import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import StoreProvider from "@/store/providers";

export const metadata: Metadata = {
  title: "Мой дневник",
  description: "Личные задачи, заметки и дневник для саморефлексии",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="dark h-full antialiased">
      <body className="flex h-dvh flex-col overflow-hidden">
        <StoreProvider>
          <div className="flex min-h-0 flex-1">
            <Navigation />
            <main className="min-w-0 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-4xl px-4 py-6 md:px-8">{children}</div>
            </main>
          </div>
          <Navigation mobile />
        </StoreProvider>
      </body>
    </html>
  );
}
