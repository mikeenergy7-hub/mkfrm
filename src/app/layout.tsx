import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Providers from "@/components/providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MKFRM",
  description: "Market framing tools",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          height: 48,
          background: "#0d0d0c",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.16em",
              color: "#d4a843",
              textTransform: "uppercase",
            }}>
              MKFRM
            </span>
            <span style={{
              width: 1,
              height: 16,
              background: "rgba(255,255,255,0.1)",
              display: "inline-block",
            }} />
            <span style={{
              fontSize: 10,
              letterSpacing: "0.1em",
              color: "#4a4845",
              textTransform: "uppercase",
            }}>
              Commodity Operations
            </span>
          </div>

          {/* Nav */}
          <nav style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {[
              { href: "/",      label: "Dashboard"   },
              { href: "/pnl",   label: "PnL Tracker" },
              { href: "/tasks", label: "Team Board"  },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#8c8780",
                  textDecoration: "none",
                  letterSpacing: "0.03em",
                  borderRadius: 6,
                  transition: "color 0.15s",
                }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </header>

        <main style={{ minHeight: "calc(100vh - 48px)" }}>
          <Providers>{children}</Providers>
        </main>
      </body>
    </html>
  );
}
