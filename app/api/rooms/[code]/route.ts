import { advanceRacer, createRace, validVehicle, type DriveCommand, type Lane, type Player } from "@/lib/game";
import { cleanCode, cleanName, getRoom, json, publicRoom, readRace, seat, updateRoom } from "@/lib/rooms";

export const runtime = "nodejs";
type Context = { params: Promise<{ code: string }> };
async function findRoom(context: Context) {
  const code = cleanCode((await context.params).code.toUpperCase());
  return code ? getRoom(code) : null;
}
export async function GET(request: Request, context: Context) {
  try {
    const room = await findRoom(context);
    if (!room) return json({ error: "Race room not found. Check the code." }, 404);
    const player = seat(room, request.headers.get("X-Player-Token"));
    if (!player) return json({ error: "This device is not in that room." }, 403);
    if (!readRace(room)) return json({ error: "This is an old room. Create a new racing room." }, 410);
    return json({ room: publicRoom(room, player) });
  } catch (error) {
    console.error("Load race failed", error);
    return json({ error: "Could not load the race." }, 503);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const room = await findRoom(context);
    if (!room) return json({ error: "Race room not found. Check the code." }, 404);
    const race = readRace(room);
    if (!race) return json({ error: "This is an old room. Create a new racing room." }, 410);
    const body = await request.json() as { action?: string; name?: unknown; vehicle?: unknown; accelerating?: unknown; lane?: unknown; nitro?: unknown };
    if (body.action === "join") {
      const name = cleanName(body.name);
      if (!name) return json({ error: "Enter your name to join." }, 400);
      const token = crypto.randomUUID();
      const now = Date.now();
      const started = { ...race, startedAt: now, racers: [
        { ...race.racers[0], lastTick: now },
        { ...race.racers[1], vehicle: validVehicle(body.vehicle), lastTick: now },
      ] };
      const joined = await updateRoom(room.code, room.revision, "waiting", {
        guest_token: token, guest_name: name, board: JSON.stringify(started), status: "playing",
      }, true);
      if (!joined) return json({ error: "This room already has two racers." }, 409);
      return json({ token, room: publicRoom(joined, 2) });
    }
    const player = seat(room, request.headers.get("X-Player-Token"));
    if (!player) return json({ error: "This device is not in that room." }, 403);
    if (body.action === "drive") {
      if (typeof body.accelerating !== "boolean" || !Number.isInteger(body.lane) || typeof body.nitro !== "boolean") {
        return json({ error: "Invalid driving input." }, 400);
      }
      const command: DriveCommand = { accelerating: body.accelerating, lane: body.lane as Lane, nitro: body.nitro };
      for (let attempt = 0; attempt < 3; attempt++) {
        const current = attempt ? await getRoom(room.code) : room;
        if (!current || current.status !== "playing") return json({ error: "The race is not running." }, 409);
        const currentRace = readRace(current);
        if (!currentRace) return json({ error: "Race data unavailable." }, 410);
        const now = Date.now();
        const next = advanceRacer(currentRace, player, command, now);
        if (!next) return json({ error: "Invalid lane or racer state." }, 400);
        const winner: Player | null = next.racers[player - 1].finishedAt ? player : null;
        const updated = await updateRoom(current.code, current.revision, "playing", {
          board: JSON.stringify(next), status: winner ? "won" : "playing", winner,
        });
        if (updated) return json({ room: publicRoom(updated, player) });
      }
      return json({ error: "Race changed. Try again." }, 409);
    }
    if (body.action === "rematch") {
      if (room.status !== "won") return json({ error: "Finish this race first." }, 409);
      const ready: [boolean, boolean] = [...race.ready];
      ready[player - 1] = true;
      const bothReady = ready[0] && ready[1];
      const now = Date.now();
      const next = bothReady ? createRace(race.racers[0].vehicle, race.racers[1].vehicle, race.round + 1, now) : { ...race, ready };
      const updated = await updateRoom(room.code, room.revision, "won", {
        board: JSON.stringify(next), status: bothReady ? "playing" : "won", winner: bothReady ? null : room.winner,
      });
      if (!updated) return json({ error: "The room changed. Try again." }, 409);
      return json({ room: publicRoom(updated, player) });
    }
    return json({ error: "Unknown race action." }, 400);
  } catch (error) {
    console.error("Race action failed", error);
    return json({ error: "Could not update the race. Try again." }, 503);
  }
}