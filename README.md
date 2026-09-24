# Nitro Rush

A car and bike arcade racing game with a solo time trial and live two-player rooms. Invite a friend from another device with a six-character code.

## How to play

- Choose a street car (steadier after collisions) or sport bike (faster acceleration and top speed).
- Tap Gas once to accelerate and again to brake, or hold Space or Up Arrow. Steer with the on-screen arrows or Left/Right or A/D keys.
- Dodge cones by switching between three lanes. A collision knocks down your speed.
- Press Nitro or N once per race for a 2.5-second speed burst.
- The first racer to reach 1000 meters wins. In solo mode, finish as fast as you can.
- Both players can vote for a rematch in the same room.

## Deploy on Render

Use `render.yaml` to create a free Node web service from this repository. It runs the full Next.js app, including multiplayer APIs. The service uses one process and keeps active race rooms in memory. On Render's free plan, a room is cleared when the service sleeps, restarts, or redeploys, so create a fresh code for a new race. No database credentials are needed.

For a manual Web Service setup, use:

- Build: `npm ci && npm run build:render`
- Start: `npm run start:render`
- Node: `24.21.0`

## Local development

```sh
npm ci
npm run dev
```

`npm run dev` uses the project's local Vinext preview. To check the Render build locally, run `npm run build:render` and then `npx next start -p 8788`.