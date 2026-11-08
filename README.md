<p align="center">
  <img src="public/brand/lagoon-logo.svg" alt="Lagoon" width="320">
</p>

<p align="center">
  A pretend games console that lives in your browser.<br>
  Your laptop is the TV. Your phone is the remote.
</p>

---

Lagoon is a fun side project inspired by the motion-control consoles of the
late 2000s. It has a home menu full of channels, a phone remote you point
and swing, an avatar maker, a shop that runs on fake points, and a few
games to play with it all.

It isn't an emulator and it doesn't run real console games. Everything in
it (graphics, sounds, music, games) is made from scratch.

> **Status:** playable. Bowling, darts, kart racing, the avatar maker and the
> shop all work.
> See the [Roadmap](#roadmap) for what's next.

## What's inside

| Channel | What it does |
| --- | --- |
| **Lagoon Sports: Bowling** | Aim with the pointer, hold B and swing your phone to bowl. Ten frames, real scoring. |
| **Lagoon Darts** | Point, steady your hand, flick to throw. |
| **Lagoon Kart** | Three laps of a seaside track against three rivals. Tip the phone like a wheel to steer, hold A to drive. |
| **Avatar Studio** | Build a character from face shapes, eyes, hair and colours. Your avatar shows up in games. |
| **Your phone** | After scanning the code, every player picks a name and look on their own phone. |
| **Lagoon Shop** | Spend points you earn in games to unlock new channels. |

The music is written in code with the Web Audio API: soft electric piano,
walking bass, brushed drums. Each menu has its own track.

## Put it on Vercel

Lagoon is just static pages, so Vercel hosts it as is, with real HTTPS
and no certificate warnings.

1. Push this repo to GitHub.
2. In Vercel, choose **Add New → Project** and import the repo. It picks up
   the settings from `vercel.json` (Vite, `npm run build`, output `dist`).
3. Deploy, open the site on a computer or TV, and scan the QR code.

On ordinary home Wi-Fi, phones and the TV link up directly. On mobile data
or guest/school Wi-Fi, they need a relay server; see
[Phones stuck connecting](#phones-stuck-connecting).

### Phones stuck connecting

The phone shows each step, so you can tell where it stopped:

| Phone says | What it means |
| --- | --- |
| Reaching the matchmaking server… | The phone can't reach the internet. |
| No TV found with that code | Wrong or old code. The TV makes a new one each time it opens. |
| Couldn't link up with the TV | The phone found the TV but the network blocked a direct link. |

The fix for the last one is a **TURN relay server**, which passes the data
along when a direct link is blocked. There's no reliable free public one, but
several providers have a free plan that gives you a fixed username and
password (Metered's free TURN plan is one). Once you have one:

1. In Vercel, open your project, then **Settings → Environment Variables**.
2. Add these three:

   | Name | Value |
   | --- | --- |
   | `VITE_TURN_URLS` | The server URLs, comma-separated, e.g. `turn:a.relay.metered.ca:80,turns:a.relay.metered.ca:443` |
   | `VITE_TURN_USERNAME` | Your TURN username |
   | `VITE_TURN_CREDENTIAL` | Your TURN password |

3. Redeploy.

These values end up in the page, so anyone could read them. Use a free or
spending-capped TURN account, not one tied to anything important.

For running locally, put the same three lines in a `.env.local` file.

## Run it on your computer

You need [Node.js](https://nodejs.org) 20 or newer, an internet connection
(phones find the TV through a matchmaking server), and your phone on the same
Wi-Fi as your computer.

```bash
npm install
npm run dev
```

1. Open **https://localhost:5173** on your computer. Your browser will warn
   about the certificate. That's expected for a local dev server, so continue
   anyway.
2. Scan the QR code on the TV screen with your phone, and accept the same
   warning there.
3. Tap **Connect** on your phone. On iPhone, allow motion access when asked.
4. Make your player: pick a name and a look, then tap **Ready**. Your phone
   remembers them for next time, and **Me** on the remote changes them.
5. Hold the phone like a remote and point it at the screen. Wherever you're
   pointing when you connect counts as the middle. If the pointer drifts,
   aim at the middle of the screen and tap **Centre**.

Up to four phones can join, each as its own player. The TV makes a new
random room code every time it opens. **New code** on the pairing screen
picks another one while nobody is connected.

### Pointer not moving?

- Make sure the phone opened an `https://` address. Phones never share
  motion data with `http://` pages, so `npm run dev:http` only works for
  mouse play.
- On iPhone, if you tapped "Don't Allow", close the tab and open the link
  again so it asks you a second time.
- Hold the phone like a TV remote: screen facing up, top edge pointing at
  the TV. Level is the middle of the screen. If the pointer sits too high,
  too low or off to one side, aim at the middle of the TV and tap Centre.

No phone handy? The mouse and keyboard stand in for player 1:

| Remote | Mouse / keyboard |
| --- | --- |
| Point | Move the mouse |
| A | Left click, Enter or Space |
| B | Right click or Shift |
| Swing | Hold right click and flick the mouse up |
| D-pad | Arrow keys |
| Home | Esc or H |
| − / + | − / = |
| 1 / 2 | 1 / 2 |

On every menu the D-pad moves the highlight, so you can get around without
pointing. In Avatar Studio, − and + flip between the Face, Hair and other
tabs. In Lagoon Kart, the arrow keys also steer.

Only testing on the computer? `npm run dev:http` skips HTTPS and the
certificate warning (phones can't use motion controls in that mode).

### Why HTTPS?

Phones only share motion sensor data with secure pages, so the dev server
uses a self-signed certificate. Nothing leaves your local network.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the dev server on your local network, over HTTPS |
| `npm run dev:http` | Same, over plain HTTP, for testing without a phone |
| `npm run build` | Type-checks and builds to `dist/` |
| `npm start` | Serves the built version locally |
| `npm run check` | Type-checks only |

## How it works

```
 phone (/remote.html)                       TV (index.html)
 ┌──────────────────┐   pointer, buttons,   ┌──────────────────────┐
 │ gyro + motion    │ ───── swings ───────▶ │ menu, channels,      │
 │ buttons          │  (WebRTC, direct)     │ games, audio         │
 │ vibration        │ ◀──── rumble ──────── │                      │
 └──────────────────┘                       └──────────────────────┘
          │                                           │
          └──── find each other by room code ─────────┘
                 (public PeerJS matchmaking server)
```

- There's no server of our own. The TV registers its room code with the free
  public [PeerJS](https://peerjs.com) server, phones look it up there, and
  then they talk to each other directly over a WebRTC data channel. If a
  direct link isn't possible (say, the phone is on mobile data), PeerJS falls
  back to its own relay.

- The phone works out where it's pointing from its gyroscope, relative to
  where it was pointing when it connected (or when you last tapped Centre).
  It also spots swings itself, so the TV gets a single `swing` message
  instead of raw sensor noise.
- The TV is the hub: it hands out player numbers, checks every message, and
  sends rumble back to phones.
- After connecting, each phone sends a `profile` message with the player's
  name and avatar. If the connection drops, the phone resends it when it
  reconnects.
- The TV runs everything else at a fixed 1280×720, scaled to fit the window.

## Project layout

```
server/          dev-only helper that puts this computer's Wi-Fi address in the QR code
src/shared/      message types, avatars and helpers used by both sides
src/remote/      the phone remote page and its player setup screen
src/tv/          home menu, avatar studio, shop, cursor, saving
src/audio/       synth voices, music sequencer, sound effects
src/games/       one folder per game
public/brand/    logo files
```

## Adding a game

Each game is a folder in `src/games/` that exports one object:

```ts
import type { LagoonGame } from "../types";

export const myGame: LagoonGame = {
  id: "my-game",
  title: "My Game",
  blurb: "One line for the shop.",
  price: 300,              // shop points, 0 means it comes installed
  icon(ctx, w, h, t) { /* draw the 250×150 channel tile */ },
  create(host) {
    // host has the player's avatar, pointers, buttons, music, rumble,
    // award(score, points) and exit()
    return {
      update(dt) {},
      draw(ctx) {},        // the stage is always 1280×720
      button(id, down, player) {},
      swing({ power, dir, p }) {},
    };
  },
};
```

Bowling (`src/games/bowling/`), darts (`src/games/darts/`) and kart
(`src/games/kart/`) are full examples.

Then add it to `src/games/registry.ts`. It appears in the shop, or on the
menu straight away if it's free.


## Roadmap

- [x] Project setup and HTTPS dev server
- [x] Phone remote: pointer, buttons, calibration, swings, rumble
- [x] Home menu, cursor and music
- [x] Avatar Studio
- [x] Lagoon Sports: Bowling
- [x] Lagoon Shop and points
- [x] Lagoon Darts
- [x] Lagoon Kart
- [x] Per-player names and avatars from each phone
- [x] Boot animation and Home pause menu
- [ ] Multiplayer turns in bowling and darts
- [ ] Split-screen kart races
- [ ] Lagoon Sports: Tennis
- [ ] Settings channel (volume, pointer sensitivity)

## Disclaimer

This is an independent fan project. It isn't affiliated with or endorsed by
any console maker. It doesn't include, and won't accept, any copyrighted
assets, music or game files from commercial consoles.
