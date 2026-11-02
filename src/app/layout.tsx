import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import { SerwistProvider } from "@serwist/turbopack/react";
import "./globals.css";
import { Providers } from "./providers";
import { siteUrl } from "@/lib/site";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const APP_NAME = "TamaRagna";
const APP_TITLE = "TamaRagna — raise a Ragnarok monster";
const APP_DESCRIPTION =
  "A Tamagotchi-inspired monster collector. Hatch Ragnarok mobs, raise them, climb the endless tower and duel other trainers. Non-commercial fan project.";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  metadataBase: new URL(siteUrl()),
  title: {
    default: APP_TITLE,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_TITLE,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: APP_TITLE,
    description: APP_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#080b11",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="min-h-dvh">
        <SerwistProvider
          swUrl="/serwist/sw.js"
          cacheOnNavigation={false}
          disable={process.env.NODE_ENV === "development"}
        >
          <Providers>{children}</Providers>
        </SerwistProvider>
      </body>
    </html>
  );
}
