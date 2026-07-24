# Hungry Hole

An eat-everything game for a three-year-old, in the spirit of hole.io but with
all the sharp edges filed off. He steers a friendly, googly-eyed hole through
**one big, organized city**; anything small enough falls in with a satisfying
gulp, the hole grows, and bigger and bigger things start to fit — until the
whole city, stadium and all, has gone down the hatch. Then a brand-new city
grows back.

Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies,
no asset files — the sounds are generated in code and the world is emoji.
The whole folder is a deployable static site.

## Designed around one rule: he cannot lose

- No timer, no lives, no enemies, no other holes, no "game over"
- A thing that is still too big just wobbles with a friendly *boing* and a
  sparkle — a promise, not a punishment. He will be back for it
- Nothing ever gets harder. The hole only ever grows, and the city always
  ends up eaten — by construction
- Every touch is answered: the hole turns and comes, and the spot sparkles

And around how a three-year-old actually uses a phone:

- **The finger is a touch-anchored joystick.** Wherever he first touches
  becomes the centre; the hole then travels in the direction he holds his
  finger *away* from that centre — and **keeps going as long as he holds it
  there**, no need to keep swiping. Further out = faster; a gentle nudge is
  slow and precise. He can steer from any corner without covering the action,
  a fresh touch never jumps the hole to his finger, and letting go glides it
  to a stop. Speed and the stick's feel are tunable in `js/config.js` under
  `hole` (`maxSpeed`, `stickRadius`, `accelK`, `deadZone`)
- **Ten fingers work at once.** The newest finger steers; lifting it hands
  control to the next one still down. A palm-slam is just a lot of downs
- **No way out.** Zoom, scroll, pull-to-refresh, long-press menus and text
  selection are all disabled. The only exit is a two-second press-and-hold

## The city — one map, no levels

There are no levels. There is **one city**, several screens big, laid out the
way a real little city is — and the layout itself is the difficulty curve,
because the small things live at the bottom and the big things at the top:

| District | What lives there |
| --- | --- |
| **The park** (bottom) | Flower beds and sunflower rows, daisies, balls, birds, children playing, park chairs, trees, a fountain — and the small hole starts here |
| **The market** | Crates and baskets by the rank, boxes of apples, oranges and strawberries, trolleys, scooters, shoppers, market cats |
| **The little houses** | A tidy grid of homes with garden flowers, trees, postboxes, dogs and neighbours |
| **The busy streets** | An asphalt parking block with painted bays and ranks of cars and taxis, buses, trucks, a fire engine, traffic lights, builders around their barriers, walkers and joggers, a police officer |
| **Downtown** (top) | A block of big buildings — offices, the shop, the bank, the hotel, the church, the school |
| **The stadium** | The one giant landmark at the very top. The last bite of all. |

The ground is a proper, **detailed top-down cityscape**: paved blocks with
kerbs, a tiled downtown plaza, a car park with painted bays and street trees,
suburban garden strips and paths, striped market-stall awnings over the fruit,
and a park with a pond, a winding path and flowerbed soil — none of it eatable,
all of it drawn under the bright chunky things. Everything is **big and bold**
(the camera sits close), the districts are laid out in **tidy grids and rows**,
and there are ~200 things across the city. Day slides into night as a light
tint over the whole scene. **The people of the city stroll about their day**,
scatter with a comic "wheee!" when the hole rumbles close, and are always
catchable.

**Eating is physics, not an animation**: the pit's pull takes hold of a
thing, it tips over as it slides in, and then it visibly sinks *below the
rim*, clipped inside the darkness — with a wet, throaty *glup* built like a
real swallow (click, glide, thump), pitched deeper the bigger the bite.

### Game feel

The polish that makes it land as a real game, not a toy — all of it pure
juice, and all of it in [`js/config.js`](js/config.js) under `juice`:

- **Drop-shadows** on everything, offset from a single light, longer for
  taller things — so the buildings loom and the whole city reads as 3-D
- **A vacuum vortex** spiralling in the hole's throat: it always looks hungry
- **Screen shake** with a size-scaled kick when big things go down, a bigger
  jolt when a district falls, the biggest when the whole city goes — clamped
  so it delights and never nauseates
- **Dust** kicked up at the rim on every swallow, for weight
- **Combo numbers** that pop and rise over the hole as the eat-streak climbs
- **Anticipation**: things lean toward the hole as it approaches (visual only)
- A soft **vignette** and a cinematic **zoom-punch** when a city is finished
- A faint **motion trail** of portal-rim ghosts behind the hole when it moves,
  so speed reads as smooth motion rather than a jump

Things come in **armies** — a bed of seven flowers, a row of four parked
cars, a block of six buildings — because a line of the same thing begs to be
hoovered up in one glorious pass. Real roads with dashed centre lines run
between the districts, a park lawn tints the bottom of the map, and the whole
city is generated from a seed, so it can be saved and resumed exactly.

A camera rides on the hole with a touch of lookahead and **zooms out as the
hole grows** — the city visibly "gets smaller" around it, which is the whole
fantasy. And whenever nothing on screen fits his mouth, or only a few things
remain anywhere, **golden arrows at the screen edge point the way** — a city
this big must never become a dead end.

## How it plays

About 110 things in seven sizes fill the city, flowers to stadium. The hole
starts small enough that only the very tiniest things fit — and **each new
size takes a satisfying while to reach**: growth shares scale with
size^1.3, so a whole flower-bed of tiny things is needed before boxes fit,
a market's worth of boxes before cars fit, and so on up to the stadium.

| When | What happens |
| --- | --- |
| Every gulp | The thing spirals down the hole with a pop-pitched gulp, sparkles fly, the hole squashes happily and grows a little. Some things have their own voice — cars vroom, cats meow, the fountain splashes — and the speaking voice names things now and then. |
| Quick gulps in a row | Each one climbs a little melody a step higher. Any pause resets it. Perfect over a flower bed. |
| Something still too big | A friendly wobble and a *boing*. Never a penalty. |
| Every fifth of the city eaten | A star flies up into the row. A chime, nothing more. |
| The golden things | An extra-big growth spurt. A chime and glitter — deliberately no trophy. |
| The magnet things | For five seconds everything nearby that fits comes sliding in by itself. A superpower, strictly positive. |
| Runners | Birds, cats and dogs scoot away from the hole. They are always slower than it — a funny chase, never a frustrating one. |
| First time eating a new kind of thing | A ring of sparkles and an "Ooh! A fire truck!" — small on purpose. |
| Every so often | A surprise crosses the sky: butterflies, a rocket, balloons, a V of birds. Pure spectacle, drawn behind the game, nothing to tap. |
| **A whole district eaten clean** | **The frequent win.** Fireworks, cheering, "The park is all clean!" — deliberately no trophy. |
| The stadium goes down | A comedy burp… |
| **…and the whole city is gone** | **The big one.** Crown, brass fanfare, confetti storms, a trophy — and a brand-new city grows back. |

**Growth is normalized over the whole city**: every thing's share is computed
so that eating everything except the stadium always opens the mouth exactly
wide enough for the stadium (plus a small margin). However the map is tuned,
progression can never dead-end — and the invariant survives saving, because
the hole's size is saved along with what it ate.

### The sky has its own clock

With no levels, the sky doesn't wait for anything: day slides into sunset,
night, dawn and round again every couple of minutes while he plays — the same
city under stars is a different place.

## It remembers him — the whole city

The save keeps the lifetime totals **and the city itself**: the city's seed,
every thing already eaten, and how big the hole has grown. Closing the app
halfway through the market and opening it tomorrow resumes *exactly there*,
same city, same hole. That matters, because one city is a long, satisfying
journey rather than a two-minute level.

- **Start over** in the grown-ups menu wipes everything and rolls a fresh
  city. The menu shows lifetime stats: things eaten, whole cities gobbled,
  kinds met
- Saves from both earlier versions of this repo (Bubble Zoo, the levelled
  Hungry Hole) migrate automatically — lifetime totals survive every update
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

- `hole.baseRadius` — how small a fresh city starts him. Raise it and boxes
  fit sooner; lower it and the flower-bed scramble lasts longer
- `city.growthExp` — the pacing dial. Higher = each new size takes longer
  to reach; 1.0 makes growth proportional to size again
- `hole.maxSpeed` and `hole.steerGain` — how fast the hole drives, and how
  much faster than the finger it moves
- `city.width` / `city.height` — how big the city is
- `camera.minZoom` / `maxZoom` — how far the camera pulls back as it grows
- `things.tierSizes` — how big each of the seven sizes is
- `things.runnerSpeed` — how fast the runners flee (keep it well under the
  hole's speed; the chase must always be winnable)
- `special.magnetSeconds` / `magnetRadius` — how big the superpower feels
- `sky.secondsPerPhase` — how quickly day turns to sunset and night
- `objectSounds.chance` and `audio.speakChance` — how chatty the city is
- `surprise.minEatsBetween` / `maxEatsBetween` — how often the sky surprises

The map itself lives in [`js/city.js`](js/city.js): each district is a few
lines of `row(…)` / `cluster(…)` / `add(…)` calls placing its things at
fractions of the city — move a district, thicken an army, or add a whole new
one freely. The sky palettes are the `PALETTES` array in
[`js/background.js`](js/background.js).

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
js/main.js              canvas sizing, game loop, camera, eating, city bookkeeping, menu wiring
js/config.js            every tunable number
js/city.js              THE MAP — districts, armies, the seeded city generator, praise phrases
js/hole.js              the hole itself: joystick steering, growth spring, gulp, eyes
js/thing.js             a thing in the city: idle, flee, wobble, spiral down
js/particles.js         pooled confetti, glitter, shards, rings, fireworks
js/celebrate.js         star row, district-clean and whole-city celebrations, first-meets
js/hud.js               star row, trophy tally, win banner, screen flash
js/audio.js             synthesized sound — gulps, boings, voices — and speech
js/background.js        the drifting skies, and the city ground: roads, lawn, border
js/surprise.js          the butterflies / rocket / balloons / birds flybys
js/save.js              the persistent city + lifetime totals (+ old-save migration)
js/input.js             multi-touch pointer tracking, gesture suppression
sw.js                   offline cache
tools/make-icons.mjs    regenerates the app icons (zero dependencies)
```

## Known limits

- **Emoji look slightly different on Android and iOS.** Fine for this purpose,
  and `city.js` is one field per thing away from real illustrations.
- **The voice is the phone's own text-to-speech**, so its quality varies by
  device. It can be switched off entirely in the grown-ups menu.
- **The sounds are synthesized approximations** — a cheerful cartoon vroom
  rather than a recording. They cost nothing to download and work offline;
  `audio.js` still prefers a real recorded sample whenever one is registered
  (`audio.samples`).
- **Fullscreen does not exist on iPhone Safari.** Installing to the home screen
  achieves the same thing there.
