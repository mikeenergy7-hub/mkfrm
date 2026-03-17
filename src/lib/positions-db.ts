import { storeGet, storeSet } from "./store";

// Positions are stored as a plain array — shape is managed entirely by the client
export type AnyPosition = Record<string, unknown>;

export async function readPositions(): Promise<AnyPosition[]> {
  return (await storeGet<AnyPosition[]>("positions")) ?? [];
}

export async function writePositions(positions: AnyPosition[]): Promise<void> {
  await storeSet("positions", positions);
}
