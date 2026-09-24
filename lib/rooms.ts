import { createRace, isRaceState, type Player, type RaceState, type Vehicle } from "./game";

export type RoomRow = {
  code: string; host_token: string; guest_token: string | null;
  host_name: string; guest_name: string | null; board: string;
  turn: Player; status: "waiting" | "playing" | "won" | "draw";
  winner: Player | null; revision: number; updated_at: number;
};

// A Render Free web service runs one instance. Race rooms live for its process lifetime.
const roomGlobals = globalThis as typeof globalThis & { __nitroRooms?: Map<string, RoomRow> };
const rooms = roomGlobals.__nitroRooms ??= new Map<string, RoomRow>();
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;

function purgeExpired() {
  const cutoff = Date.now() - ROOM_TTL_MS;
  for (const [code, room] of rooms) {
    if (room.updated_at < cutoff) rooms.delete(code);
  }
}

export async function getRoom(code: string): Promise<RoomRow | null> {
  purgeExpired();
  const room = rooms.get(code);
  return room ? { ...room } : null;
}

export async function insertRoom(code: string, token: string, name: string, board: string): Promise<RoomRow | null> {
  purgeExpired();
  if (rooms.has(code)) return null;
  const room: RoomRow = {
    code, host_token: token, guest_token: null, host_name: name, guest_name: null,
    board, turn: 1, status: "waiting", winner: null, revision: 0, updated_at: Date.now(),
  };
  rooms.set(code, room);
  return { ...room };
}

export async function updateRoom(
  code: string,
  revision: number,
  requiredStatus: RoomRow["status"],
  patch: Partial<Pick<RoomRow, "guest_token" | "guest_name" | "board" | "status" | "winner">>,
  requireEmptyGuest = false,
): Promise<RoomRow | null> {
  const current = rooms.get(code);
  if (!current || current.revision !== revision || current.status !== requiredStatus ||
      (requireEmptyGuest && current.guest_token !== null)) return null;
  const updated: RoomRow = { ...current, ...patch, revision: revision + 1, updated_at: Date.now() };
  rooms.set(code, updated);
  return { ...updated };
}

export function seat(room: RoomRow, token: string | null): Player | null {
  if (token && token === room.host_token) return 1;
  if (token && token === room.guest_token) return 2;
  return null;
}
export function readRace(room: RoomRow): RaceState | null {
  try { const race: unknown = JSON.parse(room.board); return isRaceState(race) ? race : null; }
  catch { return null; }
}
export function publicRoom(room: RoomRow, player: Player) {
  return { code: room.code, race: readRace(room), hostName: room.host_name, guestName: room.guest_name, status: room.status, winner: room.winner, revision: room.revision, player };
}
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
export function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 20) : "";
}
export function cleanCode(value: string) { return /^[A-HJ-NP-Z2-9]{6}$/.test(value) ? value : null; }
export function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
}
export const newRaceJson = (vehicle: Vehicle) => JSON.stringify(createRace(vehicle));