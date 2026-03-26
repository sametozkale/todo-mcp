import type { Metadata } from "next";
import { inter, openRunde } from "./fonts";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yalp",
  description: "Yalp — todo app",
  icons: {
    icon: [{ url: "/to-do-mcp-logo.png", type: "image/png" }],
    apple: [{ url: "/to-do-mcp-logo.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" data-theme="light">
      <body
        className={`${inter.variable} ${openRunde.variable} light bg-[#fafafa] text-foreground font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
