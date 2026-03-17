import { NextRequest, NextResponse } from "next/server";
import { readPositions, writePositions } from "@/lib/positions-db";

export async function GET() {
  return NextResponse.json(await readPositions());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!Array.isArray(body.positions)) {
      return NextResponse.json({ error: "positions must be an array" }, { status: 400 });
    }
    await writePositions(body.positions);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
