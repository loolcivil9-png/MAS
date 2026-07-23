# Hungry Hole

An eat-everything game for a three-year-old, in the spirit of hole.io but with
all the sharp edges filed off. He drags a friendly, googly-eyed hole around a
cheerful little world; anything small enough falls in with a satisfying gulp,
the hole grows, and bigger and bigger things start to fit — until the whole
world, castle and all, has gone down the hatch. Then a brand-new world arrives.

Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies,
no asset files — the sounds are generated in code and the world is emoji.
The whole folder is a deployable static site.

## Designed around one rule: he cannot lose

- No timer, no lives, no enemies, no other holes, no "game over"
- A thing that is still too big just wobbles with a friendly *boing* and a
  sparkle — a promise, not a punishment. He will be back for it
- Nothing ever gets harder. The hole only ever grows, and every level ends in
  a win by construction
- Every touch is answered: the hole turns and comes, and the spot sparkles

And around how a three-year-old actually uses a phone:

- **The hole chases the finger** with a soft ease — no aiming, no tapping
  precision, no way to steer wrong
- **Ten fingers work at once.** The newest finger wins; lifting it hands the
  hole to the next one still down. A palm-slam is just a lot of downs
- **No way out.** Zoom, scroll, pull-to-refresh, long-press menus and text
  selection are all disabled. The only exit is a two-second press-and-hold

## How a level works

A level is one screenful of a little world — about 30 things in five sizes,
from strawberries and flowers up through teddies, cars and houses to one giant
landmark. The hole starts small enough that only the tiny things fit.

| When | What happens |
| --- | --- |
| Every gulp | The thing spirals down the hole with a pop-pitched gulp, sparkles fly, the hole squashes happily and grows a little. Some things have their own voice — cars vroom, owls hoot, rockets whoosh — and the speaking voice names things now and then. |
| Quick gulps in a row | Each one climbs a little melody a step higher. Any pause resets it. |
| Something still too big | A friendly wobble and a *boing*. Never a penalty. |
| Every fifth of the world eaten | A star flies up into the row. A chime, nothing more. |
| The golden thing | An extra-big growth spurt. A chime and glitter — deliberately no trophy. |
| The magnet thing (from level 2) | For five seconds everything nearby that fits comes sliding in by itself. A superpower, strictly positive. |
| Runners | A few little creatures (ladybugs, chicks, crabs, aliens…) scoot away from the hole. They are always slower than it — a funny chase, never a frustrating one. |
| First time eating a new kind of thing | A ring of sparkles and an "Ooh! A rocket!" — small on purpose. |
| Every so often | A surprise crosses the sky: butterflies, a rocket, balloons, a V of birds. Pure spectacle, drawn behind the game, nothing to tap. |
| The landmark goes down | A comedy burp… |
| **…and the world is empty** | **The win.** Fireworks, cheering, a trophy, the voice announces the new level — and the sky crossfades to a brand-new world while a fresh one is laid out. |
| Every 5th world | The same but bigger — crown, brass fanfare, rainbow. |

**Growth is normalized at build time**: every thing's growth share is computed
so that eating everything except the landmark always opens the mouth exactly
wide enough for the landmark (plus a small margin). However the sizes and
counts are tuned, progression can never dead-end.

### Nine worlds

The star row fills as the world empties, because he cannot read. And because
he cannot read the level number either, **each level is visibly a different
place with different things in it** — meadow, sunset town, night town, beach,
candy land, outer space, snow, jungle, then round again. The sky palette and
the object set change together: the beach is full of shells and sailboats, the
snow world of snowmen and sleds, space of rockets and flying saucers.

## It remembers him

Things eaten, worlds finished and **every kind of thing he has ever met** are
saved on the device (localStorage) and restored next time:

- The sky (and its world) opens on the level he reached, and the lifetime
  counter keeps climbing for weeks
- Progress *within* a level — and the hole's size — is deliberately **not**
  saved. Every session opens on a fresh, full world with a small hole, so a
  win is always just minutes away
- **Start over** in the grown-ups menu wipes the save completely. The menu
  also shows lifetime stats: things eaten, worlds finished, kinds met
- Saves from the previous game in this repo (Bubble Zoo) are migrated
  automatically — his level and trophies survive the update
- If storage is unavailable (private browsing, quota), the game silently
  plays session-only

## Running it

Any static server works. From this folder:

```bash
npx serve . -p 5173
```

or, with no npm at all:

```bash
python -m http.server 5173
```

Then open `http://localhost:5173`.

> ES modules will not load over `file://` — opening `index.html` by
> double-clicking it will show a blank screen. Use a server.

### On the actual phone

Find your computer's LAN address (`ipconfig` on Windows), then open
`http://<that-address>:5173` on the phone while it is on the same wifi.

Some phone features only switch on over HTTPS or once deployed — installing to
the home screen, the offline cache and the screen wake lock among them. The game
itself plays fine over plain HTTP on the LAN.

## Deploying

It is a static site, so every free host works and none of them need a build
step. Drag the folder onto Netlify Drop, or:

```bash
npx netlify-cli deploy --prod --dir .
```

Cloudflare Pages, GitHub Pages and Vercel all work the same way — point them at
this folder with no build command.

Once it is on HTTPS, opening it on the phone and choosing **Add to Home Screen**
gives it a real icon, launches it fullscreen with no browser bar, and makes it
work with no signal at all.

## Tuning it after you have watched him play

Everything worth changing is in [`js/config.js`](js/config.js). Two changes
worth making first:

```js
title: "Sami's Hungry Hole",  // shown on the splash
playerName: 'Sami',           // the voice congratulates him by name
```

Hearing his own name at the winning moment is the strongest reward in here.

The dials that matter most:

- `hole.baseRadius` — how small each level starts. Raise it and the mediums
  fit sooner; lower it and the early scramble lasts longer
- `hole.followK` — how eagerly the hole chases his finger
- `things.counts` — things per size tier; the main "how long is a level" dial
- `things.tierSizes` — how big each tier is on screen
- `things.runnerSpeed` — how fast the runners flee (keep it well under the
  hole's speed; the chase must always be winnable)
- `special.magnetSeconds` / `magnetRadius` — how big the superpower feels
- `objectSounds.chance` and `audio.speakChance` — how chatty the world is
- `surprise.minEatsBetween` / `maxEatsBetween` — how often the sky surprises

The per-level skies are the `PALETTES` array in
[`js/background.js`](js/background.js); each carries a `theme` tag that picks
the matching object set in [`js/catalog.js`](js/catalog.js) — one line per
thing, with a name, an optional voice and an optional `runner` flag. Add,
remove or reorder freely.

### Knowing what is deployed

`CONFIG.version` is printed small and dim at the bottom of the home screen. Bump
it on every change — **and bump `CACHE` in [`sw.js`](sw.js) to match** — so you
can open the game on the phone and confirm at a glance that the new build
actually landed.

The service worker fetches from the network first (falling back to the cache
after 2.5 seconds, or instantly when offline). That means a deploy shows up the
first time he opens it, not the second.

## What is where

```
index.html              shell, splash, parent gate
css/style.css           splash, grown-ups menu, all the touch hardening
js/main.js              canvas sizing, game loop, level builder, eating, menu wiring
js/config.js            every tunable number
js/hole.js              the hole itself: finger-chase, growth spring, gulp, eyes
js/thing.js             a thing in the world: idle, flee, wobble, spiral down
js/catalog.js           what fills each world, tier by tier, plus the praise phrases
js/particles.js         pooled confetti, glitter, shards, rings, fireworks
js/celebrate.js         level progress, first-meet hellos, the clean-plate celebration
js/hud.js               star row, trophy tally, win banner, screen flash
js/audio.js             synthesized sound — gulps, boings, voices — and speech
js/background.js        the per-level skies (with theme tags), sun/moon, stars, clouds, hills
js/surprise.js          the butterflies / rocket / balloons / birds flybys
js/save.js              what the game remembers between sessions (+ Bubble Zoo migration)
js/input.js             multi-touch pointer tracking, gesture suppression
sw.js                   offline cache
tools/make-icons.mjs    regenerates the app icons (zero dependencies)
```

## Known limits

- **Emoji look slightly different on Android and iOS.** Fine for this purpose,
  and `catalog.js` is one field per thing away from real illustrations.
- **The voice is the phone's own text-to-speech**, so its quality varies by
  device. It can be switched off entirely in the grown-ups menu.
- **The sounds are synthesized approximations** — a cheerful cartoon vroom
  rather than a recording. They cost nothing to download and work offline;
  `audio.js` still prefers a real recorded sample whenever one is registered
  (`audio.samples`).
- **Fullscreen does not exist on iPhone Safari.** Installing to the home screen
  achieves the same thing there.
