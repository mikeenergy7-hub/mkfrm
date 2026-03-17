/**
 * Save / load Platts API credentials
 * (stored server-side via store abstraction, never sent to the browser beyond a masked preview)
 */
import { NextRequest, NextResponse } from "next/server";
import { storeGet, storeSet } from "@/lib/store";

interface PlattsSettings {
  email:    string;
  password: string;
}

async function load(): Promise<PlattsSettings> {
  const saved = await storeGet<PlattsSettings>("platts-settings");
  if (saved?.email) return saved;
  // Fall back to env vars (set in .env.local / Vercel dashboard)
  return {
    email:    process.env.PLATTS_EMAIL    || "",
    password: process.env.PLATTS_PASSWORD || "",
  };
}

export async function GET() {
  const s = await load();
  return NextResponse.json({
    email:        s.email,
    hasPassword:  s.password.length > 0,
    passwordHint: s.password ? s.password.slice(0, 2) + "•".repeat(Math.min(8, s.password.length - 2)) : "",
  });
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  await storeSet<PlattsSettings>("platts-settings", { email: email.trim(), password });
  return NextResponse.json({ ok: true });
}
