import type { Metadata, Viewport } from "next";
import { ThemeBootstrap } from "@/components/providers/ThemeBootstrap";
import { DEFAULT_APP_THEME } from "@/lib/app-theme";
import { Geist, Geist_Mono } from "next/font/google";
import {
  PWA_APP_NAME,
  PWA_APP_SHORT_NAME,
  PWA_DESCRIPTION,
  PWA_THEME_COLOR,
} from "@/lib/pwa-config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: PWA_APP_SHORT_NAME,
  title: {
    default: PWA_APP_NAME,
    template: `%s · ${PWA_APP_SHORT_NAME}`,
  },
  description: PWA_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: PWA_APP_SHORT_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [{ url: "/icons/icon-192.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon-192.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: PWA_THEME_COLOR,
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-app-theme={DEFAULT_APP_THEME}
      suppressHydrationWarning
    >
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />
        <meta name="apple-mobile-web-app-title" content={PWA_APP_SHORT_NAME} />
        <meta name="msapplication-TileColor" content={PWA_THEME_COLOR} />
        <meta name="msapplication-config" content="/icons/browserconfig.xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeBootstrap />
        {children}
      </body>
    </html>
  );
}
