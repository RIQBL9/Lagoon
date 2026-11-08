# Lagoon

A fake games console that runs in the browser. The computer is the TV and a
phone is the motion remote. It's a personal fun project inspired by mid-2000s
motion consoles, with its own original look, sounds and games. It is **not**
an emulator and does not run real console games.

## Commands

```bash
npm install
npm run dev        # HTTPS on the LAN; phones scan the QR code on the TV
npm run dev:http   # plain HTTP, for testing on the computer without a phone
npm run check      # type-check
npm run build      # type-check + production build to dist/
npm start          # serve the build locally
```

There are no unit tests yet. To check a change, run `npm run check`, then run
the app and click through it. The mouse and keyboard stand in for player 1
(see the README).

## Layout

```
server/lan.ts        dev-only Vite plugin: /api/host returns LAN IPs for the QR code
src/shared/          protocol types, avatar data + drawing, maths helpers; used by TV and phone
src/remote/          phone remote page (remote.html): gyro pointer, swing detection, buttons
  setup.ts           "Make your player" screen; profile kept in the phone's localStorage
src/tv/              TV app (index.html)
  app.ts             scene manager, fades, Home pause overlay, toasts, cursors
  screen.ts          fixed 1280×720 stage scaled to fit the window
  input.ts           remote + mouse/keyboard input, per-player pointers
  net.ts             TV as the PeerJS hub: random room code, player slots, rumble
  ui.ts              Hotspots (hover/press handling) and button drawing
  players.ts         each player's avatar from their phone (avatarFor(p))
  save.ts            localStorage save: points, installed games, avatars, bests
  scenes/            boot, pair, menu, studio (avatar maker), shop, play (runs a game)
src/audio/           Web Audio engine, synth voices, sequencer, songs, sound effects
src/games/           one folder per game + registry.ts + types.ts
src/games/kart/      pseudo-3D racer: track.ts (segments), race.ts (physics, AI, render), art.ts
public/brand/        logo files (SVG + PNG), traced from art/island.png
art/island.png       the owner's hand-drawn island; the logo comes from this
```

## Hosting

Deployed on **Vercel** as static files (`vercel.json`). There is no backend:
phones reach the TV over WebRTC (PeerJS). The TV registers
`tvPeerId(room)` on the public PeerJS server and phones dial it.
ICE servers come from `src/shared/ice.ts`: free Google/Cloudflare STUN, plus
an optional TURN relay from `VITE_TURN_URLS` / `VITE_TURN_USERNAME` /
`VITE_TURN_CREDENTIAL`. PeerJS's own built-in TURN hosts no longer exist,
so never rely on its defaults. Don't add
anything that needs a long-running server or WebSockets of our own; Vercel
can't run that.

## How things fit

- Everything on the TV is drawn on one canvas at 1280×720. Scenes implement
  `Scene` from `src/tv/app.ts` and switch with `go(scene)`.
- Clickable things are `Hotspot`s collected in a `Hotspots` list. Call
  `update(dt, pointer(1))` each frame and `press()` on A. Hover ticks and
  rumble come for free.
- Games implement `LagoonGame` from `src/games/types.ts` and get a `GameHost`.
  Add them to `src/games/registry.ts`. Price 0 means preinstalled. Anything
  else shows up in the shop.
- Everything a phone sends goes through `readToTv()` in
  `src/shared/protocol.ts` on the TV; malformed messages are dropped.
- The phone works out the pointer itself (gyro yaw/pitch relative to where it
  pointed on connecting, reset with Centre) and detects swings itself. The
  TV gets `aim`, `btn`, `swing` and `profile` messages.
- Phones without a compass heading (alpha is null) point by tilting
  (gamma) instead.
- Motion data only reaches `https://` pages. `dev:http` is for mouse testing.
- Each phone sends a `profile` (name + avatar) after its setup screen. The TV
  runs it through `cleanAvatar()` and stores it in `players.ts`. Games get
  `host.avatarFor(p)`.

## Design rules

The owner's top rule: **it must not look vibe-coded or like AI slop.**

- No purple/blue gradients, glassmorphism, emoji icons, or generic dashboard
  layouts.
- Palette lives in `C` in `src/tv/draw.ts`: off-white surfaces, thin grey
  outlines, one cyan accent, coral/green/amber for players and highlights.
  Font is M PLUS Rounded 1c.
- Motion is soft: ease-out, small hover growth, nothing flashy.
- Every icon, cursor and sprite is drawn in code (Canvas) or is one of our
  own SVGs.

## Originality rules

- No Nintendo assets, logos, fonts, sounds, music or character designs, and
  no traced UI. Being inspired by the feel is fine; copying is not.
- All music is written in `src/audio/songs.ts` as chord charts and melody
  strings. Keep new tracks original; never transcribe existing songs.
- The real Lagoon emulator project uses the same name. Fine for a private
  project, but rename it before publishing anywhere public.

## Code style

- Small files, one job each, plain names. No `utils2.ts` or `Manager` classes.
- Comment only what isn't obvious from the code.
- No dead code, no unused exports, no `any`. `tsconfig` is strict with
  `noUnusedLocals`.
- Keep the TV at 60 fps.

## What's next

1. Turn-based multiplayer for bowling and darts (players 2 to 4 already have
   their own pointers, buttons and avatars).
2. Split-screen or ghost multiplayer for Lagoon Kart.
3. Lagoon Sports: Tennis.
4. A settings channel: volume and pointer sensitivity (`YAW_RANGE` /
   `PITCH_RANGE` in `src/remote/main.ts`).
