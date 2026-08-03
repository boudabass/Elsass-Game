import type { Metadata } from "next";
import { azimut, montserrat } from "@/lib/fonts";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/auth-provider";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { IframeResizer } from "@/components/iframe-resizer";

export const metadata: Metadata = {
  title: "Arcade | The Elsassisch",
  description: "L'arcade de jeux gratuite de The Elsassisch.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${azimut.variable} ${montserrat.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <IframeResizer />
        <AuthProvider>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
