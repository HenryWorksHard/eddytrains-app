import type { Metadata, Viewport } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import NativeShell from "@/components/NativeShell";

// Self-hosted at build time rather than fetched from Google at runtime.
// The <link> version cost a DNS lookup, a TLS handshake and two round trips
// (stylesheet, then the font file) before the headings could paint, on a
// phone that may be on gym wifi. next/font serves the file from our own
// origin and inlines the @font-face, so there is no third-party request and
// no swap from the fallback once it arrives.
const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CMPD Fitness",
  description: "CMPD Fitness Portal - Training & Coaching Platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CMPD",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
  viewportFit: "cover", // required for env(safe-area-inset-*) to return real values on iOS
};

// Blocking script to prevent theme flash
const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('admin-theme');
      if (theme === 'light') {
        document.documentElement.classList.add('light-mode');
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={sora.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased min-h-screen">
        <ThemeProvider>
          <NativeShell />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
