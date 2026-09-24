"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Bike, CarFront, Check, Copy, Flag, Gauge, Play, RotateCcw, Share2, Trophy, Users, Zap } from "lucide-react";
import { advanceRacer, createRace, RACE_LENGTH, VIEW_DISTANCE, type DriveCommand, type Lane, type RaceState, type Vehicle } from "@/lib/game";

type Room = {
  code: string; race: RaceState; hostName: string; guestName: string | null;
  status: "waiting" | "playing" | "won" | "draw";
  winner: 1 | 2 | null; revision: number; player: 1 | 2;
};
const tokenFor = (code: string) => typeof window === "undefined" ? null : localStorage.getItem("nitro:" + code);

function VehicleModel({ vehicle }: { vehicle: Vehicle }) {
  return <span className={"vehicle-model " + vehicle} aria-hidden="true" />;
}
function VehiclePicker({ value, onChange }: { value: Vehicle; onChange: (value: Vehicle) => void }) {
  return <div className="vehicle-picker" aria-label="Choose your ride">
    <button type="button" className={"vehicle-choice car-choice" + (value === "car" ? " chosen" : "")} onClick={() => onChange("car")} aria-pressed={value === "car"}>
      <span className="vehicle-photo" aria-hidden="true" />
      <span className="vehicle-caption"><CarFront size={20} /><span><strong>STREET CAR</strong><small>Steady & tough</small></span></span>
    </button>
    <button type="button" className={"vehicle-choice bike-choice" + (value === "bike" ? " chosen" : "")} onClick={() => onChange("bike")} aria-pressed={value === "bike"}>
      <span className="vehicle-photo" aria-hidden="true" />
      <span className="vehicle-caption"><Bike size={20} /><span><strong>SPORT BIKE</strong><small>Fast & nimble</small></span></span>
    </button>
  </div>;
}
export default function Home() {
  const [name, setName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [vehicle, setVehicle] = useState<Vehicle>("car");
  const [joinVehicle, setJoinVehicle] = useState<Vehicle>("bike");
  const [invite] = useState(() => typeof window === "undefined" ? "" : (new URLSearchParams(window.location.search).get("room") || "").toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6));
  const [code, setCode] = useState(invite);
  const [room, setRoom] = useState<Room | null>(null);
  const [soloRace, setSoloRace] = useState<RaceState | null>(null);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [lane, setLane] = useState<Lane>(1);
  const [throttle, setThrottle] = useState(false);
  const command = useRef<DriveCommand>({ accelerating: false, lane: 1, nitro: false });
  const sending = useRef(false);

  const setGas = useCallback((value: boolean) => {
    command.current.accelerating = value;
    setThrottle(value);
  }, []);
  const steer = useCallback((direction: -1 | 1) => {
    setLane(current => {
      const next = Math.max(0, Math.min(2, current + direction)) as Lane;
      command.current.lane = next;
      return next;
    });
  }, []);
  const fireNitro = useCallback(() => { command.current.nitro = true; }, []);

  const readRoom = useCallback(async (roomCode: string) => {
    const token = tokenFor(roomCode);
    if (!token) return false;
    try {
      const response = await fetch("/api/rooms/" + roomCode, { headers: { "X-Player-Token": token }, cache: "no-store" });
      if (!response.ok) {
        if (response.status === 410) setError("Old room code. Start a fresh racing room.");
        return false;
      }
      const data = await response.json() as { room: Room };
      setRoom(current => !current || current.code !== data.room.code || data.room.revision > current.revision ? data.room : current);
      return true;
    } catch { return false; }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => invite ? readRoom(invite) : false).finally(() => setBooting(false));
  }, [invite, readRoom]);

  const activeCode = room?.code;
  useEffect(() => {
    if (!activeCode) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void readRoom(activeCode);
    }, 650);
    return () => window.clearInterval(timer);
  }, [activeCode, readRoom]);

  const onlinePlaying = !!room && room.status === "playing";
  useEffect(() => {
    if (!activeCode || !onlinePlaying) return;
    const timer = window.setInterval(async () => {
      if (sending.current) return;
      sending.current = true;
      const input = { ...command.current };
      command.current.nitro = false;
      try {
        const response = await fetch("/api/rooms/" + activeCode, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Player-Token": tokenFor(activeCode) || "" },
          body: JSON.stringify({ action: "drive", ...input }),
        });
        if (response.ok) {
          const data = await response.json() as { room: Room };
          setRoom(current => !current || data.room.revision > current.revision ? data.room : current);
        }
      } catch { /* The next tick can reconnect. */ }
      finally { sending.current = false; }
    }, 240);
    return () => window.clearInterval(timer);
  }, [activeCode, onlinePlaying]);

  const soloPlaying = !!soloRace && soloRace.racers[0].finishedAt === null;
  useEffect(() => {
    if (!soloPlaying) return;
    const timer = window.setInterval(() => {
      const input = { ...command.current };
      command.current.nitro = false;
      setSoloRace(current => current ? advanceRacer(current, 1, input, Date.now()) || current : null);
    }, 160);
    return () => window.clearInterval(timer);
  }, [soloPlaying]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") { event.preventDefault(); if (!event.repeat) steer(-1); }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") { event.preventDefault(); if (!event.repeat) steer(1); }
      if (event.key === "ArrowUp" || event.code === "Space") { event.preventDefault(); setGas(true); }
      if (event.key.toLowerCase() === "n") { event.preventDefault(); fireNitro(); }
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp" || event.code === "Space") { event.preventDefault(); setGas(false); }
    };
    const blur = () => setGas(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, [steer, setGas, fireNitro]);

  function resetControls() {
    command.current = { accelerating: false, lane: 1, nitro: false };
    setLane(1); setThrottle(false);
  }
  function startSolo() {
    resetControls(); setError(""); setRoom(null); setSoloRace(createRace(vehicle));
    window.history.replaceState({}, "", "/");
  }
  function goHome() {
    resetControls(); setRoom(null); setSoloRace(null); setError(""); setCode("");
    window.history.replaceState({}, "", "/");
  }

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Enter your racer name.");
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, vehicle }) });
      const data = await response.json() as { error?: string; token: string; room: Room };
      if (!response.ok) throw new Error(data.error || "Could not create race.");
      localStorage.setItem("nitro:" + data.room.code, data.token);
      window.history.replaceState({}, "", "/?room=" + data.room.code);
      resetControls(); setRoom(data.room); setSoloRace(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create race."); }
    finally { setBusy(false); }
  }
  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    const roomCode = code.trim().toUpperCase();
    if (roomCode.length !== 6) return setError("Enter the six-character room code.");
    setBusy(true); setError("");
    try {
      if (tokenFor(roomCode) && await readRoom(roomCode)) {
        window.history.replaceState({}, "", "/?room=" + roomCode);
        return;
      }
      if (!joinName.trim()) throw new Error("Enter your racer name.");
      const response = await fetch("/api/rooms/" + roomCode, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join", name: joinName, vehicle: joinVehicle }) });
      const data = await response.json() as { error?: string; token: string; room: Room };
      if (!response.ok) throw new Error(data.error || "Could not join race.");
      localStorage.setItem("nitro:" + roomCode, data.token);
      window.history.replaceState({}, "", "/?room=" + roomCode);
      resetControls(); setRoom(data.room); setSoloRace(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not join race."); }
    finally { setBusy(false); }
  }
  async function copyInvite() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(window.location.origin + "/?room=" + room.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { setError("Copy failed. Share the code instead."); }
  }
  async function rematch() {
    if (!room || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/rooms/" + room.code, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Player-Token": tokenFor(room.code) || "" },
        body: JSON.stringify({ action: "rematch" }),
      });
      const data = await response.json() as { error?: string; room: Room };
      if (!response.ok) throw new Error(data.error || "Could not start rematch.");
      resetControls();
      setRoom(data.room);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start rematch."); }
    finally { setBusy(false); }
  }

  const race = room?.race || soloRace;
  const myIndex = room ? room.player - 1 : 0;
  const me = race?.racers[myIndex];
  const other = room ? race?.racers[1 - myIndex] : null;
  const rivalName = room ? (room.player === 1 ? room.guestName : room.hostName) : null;
  const finished = room ? room.status === "won" : me?.finishedAt !== null && !!me;
  const racing = room ? room.status === "playing" : !!soloRace && !finished;
  const elapsed = me && race ? ((me.finishedAt || me.lastTick) - race.startedAt) / 1000 : 0;
  const progress = me ? Math.min(100, me.distance / RACE_LENGTH * 100) : 0;
  const otherProgress = other ? Math.min(100, other.distance / RACE_LENGTH * 100) : 0;
  const opponentBottom = me && other ? 14 + (other.distance - me.distance) / VIEW_DISTANCE * 76 : 0;
  const motionSeconds = Math.max(0.13, 0.65 - (me?.speed || 0) / 500);
  const statusText = room?.status === "waiting" ? "Waiting for your rival to join..."
    : finished ? (!room || room.winner === room.player ? "YOU WIN THE RACE!" : (rivalName || "Your rival") + " wins this race")
    : racing ? "Tap GAS, dodge cones, hit NITRO!" : "";

  return <main className="shell">
    <div className="glow glow-a" /><div className="glow glow-b" />
    <header className="topbar"><button className="brand" onClick={goHome} aria-label="Nitro Rush home"><span className="brand-symbol"><Zap size={22} fill="currentColor" /></span><span>NITRO<span>RUSH</span></span></button><div className="topbar-right"><span className="live-dot" /> LIVE ARCADE RACING <span className="topbar-separator">/</span> CAR + BIKE DUEL</div></header>

    {!race ? <div className="home-content">
      <section className="hero"><div className="eyebrow"><span className="eyebrow-line" /> READY, SET, RACE</div><h1>Own the road.<br /><em>Leave them behind.</em></h1><p>Pick a car or bike. Swerve past cones, punch the nitro, and cross the finish line first. Race a friend live or jump into a solo time trial.</p><div className="hero-chips"><span><Gauge size={17} /> FAST RACES</span><span><Users size={17} /> PLAY TOGETHER</span><span><Trophy size={17} /> ONE WINNER</span></div></section>
      <div className="home-grid">
        <section className="race-card quick-card"><div className="card-top"><span>01 / PLAY RIGHT NOW</span><Flag size={22} /></div><h2>Solo time trial</h2><p>Learn the track, beat the cones, and chase your fastest finish.</p><VehiclePicker value={vehicle} onChange={setVehicle} /><button className="action-button hot" onClick={startSolo}><Play size={18} fill="currentColor" /> Start racing <ArrowRight size={18} /></button></section>
        <section className="race-card host-card"><div className="card-top"><span>02 / CHALLENGE A FRIEND</span><Users size={22} /></div><h2>Create a race</h2><p>Open a private room and invite a friend to race from their device.</p><form onSubmit={createRoom}><label htmlFor="host-name">YOUR RACER NAME</label><input id="host-name" maxLength={20} autoComplete="nickname" placeholder="Type your name" value={name} onChange={event => setName(event.target.value)} /><VehiclePicker value={vehicle} onChange={setVehicle} /><button className="action-button yellow" type="submit" disabled={busy}>Create room <ArrowRight size={18} /></button></form></section>
        <section className="race-card join-card"><div className="card-top"><span>03 / JOIN THE GRID</span><Share2 size={22} /></div><h2>Join a race</h2><p>Have a room code? Choose your ride and get to the starting line.</p><form onSubmit={joinRoom}><label htmlFor="join-name">YOUR RACER NAME</label><input id="join-name" maxLength={20} autoComplete="nickname" placeholder="Type your name" value={joinName} onChange={event => setJoinName(event.target.value)} /><label htmlFor="room-code">ROOM CODE</label><input id="room-code" className="room-input" maxLength={6} autoComplete="off" placeholder="ABC234" value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))} /><VehiclePicker value={joinVehicle} onChange={setJoinVehicle} /><button className="action-button outline" type="submit" disabled={busy}>Join race <ArrowRight size={18} /></button></form></section>
      </div>
      <div className="instructions"><strong>HOW TO DRIVE</strong><span>Tap GAS to drive, or hold <kbd>SPACE</kbd> / <kbd>↑</kbd></span><span><kbd>←</kbd> <kbd>→</kbd> to change lanes</span><span><kbd>N</kbd> for nitro</span><span>On a phone, use the buttons on screen.</span></div>
      {booting && <div className="loading-note">Loading invite...</div>}
    </div> : <div className="race-content">
      <div className="race-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> {room ? "LIVE 1V1 RACE" : "SOLO TIME TRIAL"} · ROUND {race.round}</div><h1>{finished ? "Finish line." : room?.status === "waiting" ? "Waiting on the grid." : "Full throttle."}</h1></div><button className="leave-button" onClick={goHome}>Exit race</button></div>
      <div className="race-layout"><section className="track-card">
        <div className="track-top"><div><span className="overline">{room ? "PRIVATE RACE ROOM" : "PRACTICE SESSION"}</span><strong>{room ? room.code : "SOLO RUN"}</strong></div>{room && <button className="invite-button" onClick={copyInvite}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? "Copied" : "Copy invite"}</button>}</div>
        <div className="race-status" role="status" aria-live="polite">{finished ? <Trophy size={19} /> : <Zap size={19} />}{statusText}</div>
        <div className="hud"><div><span>SPEED</span><strong>{Math.round(me?.speed || 0)}<small> km/h</small></strong></div><div><span>DISTANCE</span><strong>{Math.floor(me?.distance || 0)}<small> / {RACE_LENGTH}m</small></strong></div><div><span>TIME</span><strong>{Math.max(0, elapsed).toFixed(1)}<small> sec</small></strong></div></div>
        <div className={"road" + (racing && (me?.speed || 0) > 2 ? " moving" : "") + (me && me.nitroUntil > me.lastTick ? " turbo" : "") + (me && me.lastTick - me.lastHit < 650 ? " hit" : "")} aria-label="Three lane racing track">
          <div className="road-edge left" /><div className="road-edge right" /><div className="lane-line first" style={{ animationDuration: motionSeconds + "s" }} /><div className="lane-line second" style={{ animationDuration: motionSeconds + "s" }} />
          <div className="road-texture" style={{ animationDuration: motionSeconds + "s" }} />
          {race.obstacles.filter(obstacle => me && obstacle.at >= me.distance - 10 && obstacle.at <= me.distance + VIEW_DISTANCE).map(obstacle => <div key={obstacle.at} className={"cone lane-" + obstacle.lane} style={{ bottom: (14 + (obstacle.at - (me?.distance || 0)) / VIEW_DISTANCE * 76) + "%" }}><span>▲</span><small>CONE</small></div>)}
          {RACE_LENGTH - (me?.distance || 0) <= VIEW_DISTANCE && <div className="finish-line" style={{ bottom: (14 + (RACE_LENGTH - (me?.distance || 0)) / VIEW_DISTANCE * 76) + "%" }}><span>FINISH</span></div>}
          {other && opponentBottom > 0 && opponentBottom < 98 && <div className={"racer-sprite rival lane-" + other.lane} style={{ bottom: opponentBottom + "%" }}><span className="racer-label">{rivalName}</span><VehicleModel vehicle={other.vehicle} /></div>}
          {me && <div className={"racer-sprite mine lane-" + lane + (me.nitroUntil > me.lastTick ? " boosting" : "")}><span className="racer-label">YOU</span><VehicleModel vehicle={me.vehicle} /><span className="exhaust" /></div>}
          {room?.status === "waiting" && <div className="waiting-overlay"><Users size={38} /><strong>Waiting for racer 2</strong><span>Share the code to start.</span></div>}
        </div>
        <div className="race-controls"><button className="steer-button" onClick={() => steer(-1)} disabled={!racing || lane === 0} aria-label="Steer left"><ArrowLeft size={27} /><span>LEFT</span></button><button className={"gas-button" + (throttle ? " pressed" : "")} disabled={!racing} onClick={() => setGas(!command.current.accelerating)}><Gauge size={25} /><strong>{throttle ? "BRAKE" : "TAP GAS"}</strong></button><button className="steer-button" onClick={() => steer(1)} disabled={!racing || lane === 2} aria-label="Steer right"><ArrowRight size={27} /><span>RIGHT</span></button><button className="nitro-button" onClick={fireNitro} disabled={!racing || !me?.nitroReady}><Zap size={22} fill="currentColor" /><span>{me?.nitroReady ? "NITRO" : "USED"}</span></button></div>
      </section><aside className="race-sidebar">
        <div className="sidebar-panel standings"><span className="overline">RACE PROGRESS</span><h3>{room ? "Head to head." : "Beat your time."}</h3><div className="progress-label"><span>YOU · {me?.vehicle.toUpperCase()}</span><strong>{Math.round(progress)}%</strong></div><div className="progress-track"><span style={{ width: progress + "%" }} /></div>{other && <><div className="progress-label rival-label"><span>{rivalName?.toUpperCase()} · {other.vehicle.toUpperCase()}</span><strong>{Math.round(otherProgress)}%</strong></div><div className="progress-track rival-track"><span style={{ width: otherProgress + "%" }} /></div></>}<p>{room?.status === "waiting" ? "The race starts automatically when your friend joins." : "First racer to reach 1000m wins. Cones knock down your speed."}</p></div>
        <div className="sidebar-panel tips"><span className="overline">DRIVER BRIEFING</span><h3>Drive smart. Win fast.</h3><div className="tip"><span>01</span><p>Tap GAS to drive, tap again to brake. Or hold Space on a keyboard.</p></div><div className="tip"><span>02</span><p>Steer left and right to dodge cones. Hitting one costs speed.</p></div><div className="tip"><span>03</span><p>Press NITRO once per race for a burst of speed.</p></div><div className="key-row"><kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>N</kbd></div></div>
        {finished && (room ? <div className="sidebar-panel finish-panel"><Trophy size={29} /><h3>{room.winner === room.player ? "Victory is yours!" : "Race again?"}</h3><p>{race.ready[myIndex] ? "Waiting for your rival to accept." : "Both racers must choose rematch."}</p><button className="action-button hot" onClick={rematch} disabled={busy || race.ready[myIndex]}><RotateCcw size={17} /> {race.ready[myIndex] ? "Ready!" : "Rematch"}</button></div> : <div className="sidebar-panel finish-panel"><Trophy size={29} /><h3>Run complete!</h3><p>Your finish time: {elapsed.toFixed(1)} seconds.</p><button className="action-button hot" onClick={startSolo}><RotateCcw size={17} /> Race again</button></div>)}
      </aside></div>
    </div>}
    {error && <div className="error-toast" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss">×</button></div>}
    <footer>NITRO RUSH <span>✦</span> BUILT FOR THE FINISH LINE</footer>
  </main>;
}
