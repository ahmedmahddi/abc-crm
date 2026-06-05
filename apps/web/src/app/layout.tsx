import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Newsreader } from "next/font/google";
import { QueryProvider } from "@/components/providers/query-provider";
import "./globals.css";

const display = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-newsreader",
  weight: ["500", "600", "700"],
});
const body = IBM_Plex_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ibm-plex-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ABC CRM",
  description: "CRM PWA for ABC Consulting missions and clients.",
  applicationName: "ABC CRM",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#125885",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${display.variable} ${body.variable}`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
