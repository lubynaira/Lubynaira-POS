import type { Metadata, Viewport } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Skupy HPP Gamis",
  description:
    "Aplikasi SaaS profesional untuk menghitung HPP, harga jual, profit, dan laporan produk fashion muslimah.",
  applicationName: "Skupy HPP Gamis",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Skupy HPP"
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/maskable.svg", type: "image/svg+xml" }
    ],
    apple: [{ url: "/icons/icon.svg", type: "image/svg+xml" }]
  }
};

export const viewport: Viewport = {
  themeColor: "#cb9e36",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var savedTheme = localStorage.getItem("skupy-theme");
                  var preferredDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                  var theme = savedTheme || (preferredDark ? "dark" : "light");
                  document.documentElement.classList.toggle("dark", theme === "dark");
                } catch (error) {}
              })();
            `
          }}
        />
        {children}
      </body>
    </html>
  );
}
