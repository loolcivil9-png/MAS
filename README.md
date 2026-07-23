# Bubble Zoo

An endless bubble-popping game for a three-year-old. Bubbles float up carrying
animals and dinosaurs; touching one pops it, the creature leaps out, and
something good happens every single time.

Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies,
no asset files — the sounds are generated in code and the creatures are emoji.
The whole folder is a deployable static site.

## Designed around one rule: he cannot lose

- No timer, no lives, no score that goes down, no "you missed"
- Bubbles that drift off the top leave silently — nothing marks it as a failure
- Nothing ever speeds up. Variety increases instead: rarer creatures unlock as
  he plays, which is the good half of difficulty with none of the frustration
- Every touch is answered. Even a tap on empty screen makes sparkles

And around how a three-year-old actually uses a phone:

- **Smearing counts.** Dragging a finger pops every bubble along the path
- **Ten fingers work at once.** A whole palm on the screen pops everything under it
- **Big targets.** 120–210 px bubbles with a touch radius 35% larger than the drawing
- **No way out.** Zoom, scroll, pull-to-refresh, long-press menus and text
  selection are all disabled. The only exit is a two-second press-and-hold

## Winning

| When | What happens |
| --- | --- |
| Every pop | Pop sound, glitter, shockwave, the creature's name spoken |
| Every 5 | A star flies up into the row, confetti, a chime, praise |
| Every 15 | The star lands, then fireworks, cheering and a trophy |
| Every 50 | The same but bigger — crown, brass fanfare, rainbow |
| ~1 in 15 bubbles | A golden bubble: the big party at random |

Progress reads as a row of three stars rather than a number, because he cannot
read yet. Nothing is saved between sessions — every session starts a fresh
winning streak.

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

Everything worth changing is in [`js/config.js`](js/config.js) — bubble size and
speed, how many are on screen, how generous the touch radius is, the celebration
thresholds, the odds of a golden bubble, the volume and how often the voice
speaks.

Two changes worth making first:

```js
title: "Sami's Bubble Zoo",   // shown on the splash
playerName: 'Sami',           // the voice congratulates him by name
```

Hearing his own name at the winning moment is the strongest reward in here.

If it is too busy, lower `bubble.maxOnScreen`. If he is not landing his taps,
raise `bubble.hitScale`. If the parties feel too rare, lower
`celebrate.partyEvery`.

The cast lives in [`js/creatures.js`](js/creatures.js) — one line per animal,
with a weight and the score it unlocks at. Add, remove or reorder freely.

## What is where

```
index.html              shell, splash, parent gate
css/style.css           splash, grown-ups menu, all the touch hardening
js/main.js              canvas sizing, game loop, bubble population, menu wiring
js/config.js            every tunable number
js/creatures.js         the cast, plus the praise phrases
js/bubble.js            rise, sway, hit test, and the procedural glass drawing
js/creaturePop.js       the creature leaping out and bouncing away
js/particles.js         pooled confetti, glitter, shards, rings, fireworks
js/celebrate.js         the four winning tiers
js/hud.js               star row, trophy tally, win banner, screen flash
js/audio.js             synthesized sound and the speaking voice
js/background.js        sky, sun, clouds, hills
js/input.js             multi-touch, drag-to-pop, gesture suppression
sw.js                   offline cache
tools/make-icons.mjs    regenerates the app icons (zero dependencies)
```

## Known limits

- **Emoji look slightly different on Android and iOS.** Fine for this purpose,
  and `creatures.js` is structured so real illustrations can replace them by
  changing one field per creature.
- **The voice is the phone's own text-to-speech**, so its quality varies by
  device. It can be switched off entirely in the grown-ups menu.
- **No real animal sounds yet.** Synthesis cannot make a convincing lion roar,
  and a real roar is a much bigger payoff for a small child than anything
  generated. `audio.js` already prefers a recorded sample over the voice when
  one is registered (`audio.samples`), so adding them is a data change rather
  than a rewrite.
- **Fullscreen does not exist on iPhone Safari.** Installing to the home screen
  achieves the same thing there.
