export type Player = 1 | 2;
export type Vehicle = "car" | "bike";
export type Lane = 0 | 1 | 2;
export type Racer = {
  vehicle: Vehicle;
  distance: number;
  speed: number;
  lane: Lane;
  hits: number;
  nitroReady: boolean;
  nitroUntil: number;
  lastTick: number;
  lastHit: number;
  finishedAt: number | null;
};
export type Obstacle = { at: number; lane: Lane };
export type RaceState = {
  racers: [Racer, Racer];
  obstacles: Obstacle[];
  round: number;
  ready: [boolean, boolean];
  startedAt: number;
};
export const RACE_LENGTH = 1000;
export const VIEW_DISTANCE = 165;

export function validVehicle(value: unknown): Vehicle {
  return value === "bike" ? "bike" : "car";
}
function racer(vehicle: Vehicle, now: number): Racer {
  return { vehicle, distance: 0, speed: 0, lane: 1, hits: 0, nitroReady: true, nitroUntil: 0, lastTick: now, lastHit: 0, finishedAt: null };
}
export function createRace(host: Vehicle, guest: Vehicle = "car", round = 1, now = Date.now()): RaceState {
  const obstacles: Obstacle[] = [];
  let at = 90;
  while (at < RACE_LENGTH - 50) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0];
    obstacles.push({ at, lane: (random % 3) as Lane });
    at += 65 + (random % 25);
  }
  return { racers: [racer(host, now), racer(guest, now)], obstacles, round, ready: [false, false], startedAt: now };
}
export function isRaceState(value: unknown): value is RaceState {
  if (!value || typeof value !== "object") return false;
  const race = value as Partial<RaceState>;
  return Array.isArray(race.racers) && race.racers.length === 2 &&
    race.racers.every(car => car && (car.vehicle === "car" || car.vehicle === "bike") && typeof car.distance === "number") &&
    Array.isArray(race.obstacles) && Array.isArray(race.ready) && typeof race.round === "number";
}
export type DriveCommand = { accelerating: boolean; lane: Lane; nitro: boolean };
export function advanceRacer(race: RaceState, player: Player, command: DriveCommand, now = Date.now()): RaceState | null {
  const current = race.racers[player - 1];
  if (current.finishedAt !== null || !Number.isInteger(command.lane) || command.lane < 0 || command.lane > 2 || Math.abs(command.lane - current.lane) > 1) return null;
  const dt = Math.max(0, Math.min((now - current.lastTick) / 1000, 0.4));
  const bike = current.vehicle === "bike";
  const maxSpeed = bike ? 285 : 260;
  const acceleration = bike ? 170 : 145;
  const speed = command.accelerating
    ? Math.min(maxSpeed, current.speed + acceleration * dt)
    : Math.max(0, current.speed - 125 * dt);
  const fireNitro = command.nitro && current.nitroReady;
  const nitroUntil = fireNitro ? now + 2500 : current.nitroUntil;
  const boosted = now < nitroUntil;
  const before = current.distance;
  let nextSpeed = speed;
  let distance = Math.min(RACE_LENGTH, before + (speed / 3.6) * (boosted ? 2.1 : 1) * dt);
  let hits = current.hits;
  let lastHit = current.lastHit;
  for (const obstacle of race.obstacles) {
    if (obstacle.lane === command.lane && obstacle.at > before && obstacle.at <= distance) {
      hits++;
      lastHit = now;
      nextSpeed *= bike ? 0.38 : 0.52;
      distance = Math.max(obstacle.at + 1, distance - 12);
    }
  }
  const updated: Racer = {
    ...current, lane: command.lane, speed: nextSpeed, distance, hits, lastHit,
    nitroReady: fireNitro ? false : current.nitroReady, nitroUntil, lastTick: now,
    finishedAt: distance >= RACE_LENGTH ? now : null,
  };
  const racers: [Racer, Racer] = [...race.racers];
  racers[player - 1] = updated;
  return { ...race, racers };
}
