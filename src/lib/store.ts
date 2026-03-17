/**
 * Storage abstraction:
 *   - Development  → JSON files in /data  (existing behaviour, no changes needed)
 *   - Production   → Vercel KV (Redis)    (set KV_REST_API_URL + KV_REST_API_TOKEN in Vercel dashboard)
 */
import fs   from "fs";
import path from "path";

const USE_KV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

export async function storeGet<T>(key: string): Promise<T | null> {
  if (USE_KV) {
    const { kv } = await import("@vercel/kv");
    return kv.get<T>(key);
  }
  // Filesystem fallback (local dev)
  const file = path.join(process.cwd(), "data", `${key}.json`);
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch (_) {}
  return null;
}

export async function storeSet<T>(key: string, value: T): Promise<void> {
  if (USE_KV) {
    const { kv } = await import("@vercel/kv");
    await kv.set(key, value);
    return;
  }
  // Filesystem fallback (local dev)
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${key}.json`), JSON.stringify(value, null, 2));
}
