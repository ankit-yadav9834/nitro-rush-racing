import { validVehicle } from "@/lib/game";
import { cleanName, insertRoom, newRaceJson, json, publicRoom, roomCode } from "@/lib/rooms";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: unknown; vehicle?: unknown };
    const name = cleanName(body.name);
    if (!name) return json({ error: "Enter your name to create a race." }, 400);
    const vehicle = validVehicle(body.vehicle);
    const token = crypto.randomUUID();
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = roomCode();
      const room = await insertRoom(code, token, name, newRaceJson(vehicle));
      if (room) return json({ token, room: publicRoom(room, 1) }, 201);
    }
    return json({ error: "Could not create a race. Try again." }, 503);
  } catch (error) {
    console.error("Create race failed", error);
    return json({ error: "Race storage is temporarily unavailable. Try again." }, 503);
  }
}