import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const brice = localFont({
  src: [
    { path: "../../public/fonts/Brice-Bold.otf", weight: "700" },
    { path: "../../public/fonts/Brice-Black.otf", weight: "900" },
  ],
  variable: "--font-brice",
  display: "swap",
});

const mundial = localFont({
  src: [
    { path: "../../public/fonts/Mundial-Regular.otf", weight: "400" },
    { path: "../../public/fonts/MundialDemibold.otf", weight: "600" },
    { path: "../../public/fonts/Mundial-Bold.otf", weight: "700" },
  ],
  variable: "--font-mundial",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VibeMatch | Good Vibes Club",
  description: "Match-3 puzzle game featuring GVC badges. Match badges, score big, climb the leaderboard.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192x192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VibeMatch",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${brice.variable} ${mundial.variable} antialiased`}>
        <div className="relative z-10">
          {children}
        </div>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "rgba(45, 27, 105, 0.9)",
              color: "#fff",
              border: "1px solid rgba(255, 224, 72, 0.3)",
              backdropFilter: "blur(12px)",
              fontFamily: "var(--font-mundial), sans-serif",
            },
          }}
        />
      </body>
    </html>
  );
}
