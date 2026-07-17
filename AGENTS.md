# Super Orion — agent rules

This is a kid's 2D platformer. **Everything lives in one file: `index.html`** (engine, sprites, audio, and the `const LEVELS = [...]` array of ASCII tile maps). There is no build step; opening `index.html` in a browser runs the game.

## Hard rules

1. **Only touch the `LEVELS` array** (and the level list in `README.md`) unless explicitly asked to change engine code.
2. **Never change physics constants** (`GRAV`, `JUMP_V`, `SPRING_V`, `MOVE_ACC`, `MAX_SPD`). Every level is balanced around them.
3. **Never edit or delete existing levels** unless explicitly asked.
4. **Never hand-type map rows.** You WILL miscount spaces. Always generate rows with the `put(row, col, str)` script method (see workflow below).
5. A level change is **not done** until `node levelcheck.js index.html` prints `RESULT: PASS`. Paste that output in your final answer as proof.

## Required workflow for adding a level

```
copy levelgen.template.js levelgen-work.js
(edit CONFIG + PLACEMENTS in levelgen-work.js)
node levelgen-work.js                 → prints a ruler preview + a paste-ready level object
(paste the object into LEVELS in index.html, just above the final `];`)
node levelcheck.js index.html         → must end with: RESULT: PASS
(update the level list line in README.md)
del levelgen-work.js
```

If the checker prints `[FAIL]` lines, fix the placements in `levelgen-work.js`, regenerate, re-paste, and re-check. Do not ship a FAIL.

## When levelcheck FAILs — debugging rules (read before touching anything)

1. **The checker reads `index.html`, NOT `levelgen-work.js`.** After ANY edit to `levelgen-work.js` you MUST re-run it and re-paste the fresh object over the old one in `index.html` before re-running the checker. If the checker reports tiles you believe you already moved, the two files are out of sync — re-paste first, do not investigate.
2. **Never reconstruct the grid in your head.** Do not reason from memory about which column holds which tile — run `node levelgen-work.js` and read coordinates off the ruler preview, or run this one-liner against the real file:
   `node -e "const L=eval(require('fs').readFileSync('index.html','utf8').match(/const LEVELS = (\[[\s\S]*?\n\]);/)[1]);L[IDX].main.forEach((row,r)=>{let s='';for(let c=0;c<row.length;c++)if(row[c]!==' ')s+=c+':'+row[c]+' ';if(s)console.log(r,s)})"`
3. **One FAIL line = one small placement fix, then immediately re-check.** Keep deliberation to a few sentences; if the same FAIL survives 3 fix attempts, stop and report what you tried instead of re-deriving the level.
4. **Common root causes, check these first:** (a) a floating platform more than 4 rows above the nearest floor is unreachable unless a spring sits on the floor within ~2 cols of the platform's edge (spring bounce reaches 6 rows and drifts 2-3 cols); stars above an unreachable platform are unreachable too. (b) a `D` you cannot STAND ON (solid tile directly above it, or no route up) fails the secret-pipe check. (c) blocks under a platform's footprint cannot be stood on.

## Physics envelope (what the player can actually do)

| Move | Limit | Design rule |
|---|---|---|
| Jump height | 4.5 tiles | Max climb per jump: **4 rows** (use 2-3 for comfort) |
| Jump distance | ~6 tiles | Max pit width: **4 cols** (use 2-3 for kids) |
| Spring bounce | ~6.6 tiles | Platforms up to **6 rows** above a spring; never put solid tiles directly above a spring (head-bonk loop) |
| Head bump | reaches ~5 rows up | `?`/`T`/`U` blocks on **row 11 over ground** are both bumpable and standable |

## Map legend (17 rows: 0=top, 15=ground surface, 16=underground)

```
'#' ground top   'x' dirt/stone     '=' breakable brick   'B' used block
'?' block→star   'T' block→taco     'U' block→1-UP        '*' invisible 1-UP block
'o' star         '^' spikes (hurt)  'S' spring (solid, bouncy)
'()' pipe top    '[]' pipe body     'Dd' SECRET pipe top: TWO tiles SIDE-BY-SIDE on the SAME row, D left + d right, NEVER stacked vertically (press ↓ = bonus room)
'E' grumblin     'V' flapjack       'F' flag (goal)       'p' spawn   ',' decoration
'K' prickleburr (spiky walker — stomping HURTS the player; killed only by a kicked shell)
'J' hoppit (frog; hops toward the player when within ~0.75 screens; stompable)
'R' rolypoly (stomp → idle shell; touch shell → kicks off, bowls over other enemies, bounces off walls, never hurts the player; stomp a sliding shell to stop it)
'G' KING DAD boss (3 stomps to defeat; hops toward player, angrier each hit; max ONE per level)
'W' castle gate (solid until the 'G' boss is defeated, then crumbles — checker treats it as OPEN, but a 'W' without a 'G' in the level is an instant FAIL)
'M' Mum (rescue NPC — walk into her after the gate falls; max ONE per level; needs floor below like enemies)
```

## Quirks that break levels if ignored

- `E` spawns standing on the row BELOW its marker → put `E` on row 14 over ground, or row N-1 over a platform at row N. An `E` with no floor below falls out of the world.
- `V` flies a sine wave (±36px vertical, ±90px horizontal from its marker) and **ignores walls**.
- `F` draws a 7-tile pole upward and triggers on x-position: place on row 14 with ground below and keep ~5 cols of ground after it.
- `p` drops to the first floor below it. Keep the first ~8 cols free of enemies, spikes and pits.
- A `Dd` pipe requires the level object to have `bonus` (map), `bonusSpawn` ([col,row] in bonus), and `mainReturn` ([col,row] of the D tile in main). The bonus room MUST contain its own `Dd` exit pipe or the player is trapped. No `p`, `F`, `E`, `V` in bonus rooms. Copy Level 4's bonus wiring as the reference.
- Stars inside `?` blocks count toward the level's star total automatically; `T`, `U`, `*` do not.
- `K`/`J`/`R`/`G`/`M` follow the same "needs floor below" rule as `E`. Bonus rooms must not contain any of them (or `W`).
- A boss level (`G` + `W` gate + `M`) must have **no pits at all** — King Dad hops toward the player and a boss in a pit = gate never opens = softlock. Copy Level 10's wiring as the reference: 5-tall `W` column (rows 10-14, unjumpable), `M` then `F` behind it.
- Optional palette fields: `weather:'snow'|'embers'|'bubbles'` (ambient particles) and `ice:true` (slippery ground friction). Both validated by the checker if present.

## Design taste (it's for a young kid)

- Length 110-135 cols, 15-25 stars, 2-5 blocks, 4-8 enemies, one gimmick per level (springs, platform crossing, spike hops...).
- Stars in lines/arcs that trace where the player should go. Above platforms = walk-to-collect.
- Difficulty ramps leftright within the level; nothing cruel right after a checkpoint-less death.
- Sprinkle `,` decorations on row 14; pick a cohesive palette (look at the 5 existing ones).

## Verifying beyond the checker

The game exposes `window.__SO = { G, player, loadLevel, LEVELS, keys }` in the browser console for manual testing (`__SO.loadLevel(5); __SO.G.state='PLAY'`). Use it if asked to debug, but `levelcheck.js` PASS is the required gate.
