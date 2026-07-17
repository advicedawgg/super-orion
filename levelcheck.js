'use strict';
/* Level verifier for Super Orion.  Usage:  node levelcheck.js index.html
   Reads physics constants + LEVELS straight out of index.html, validates level
   structure, then BFS-simulates the player's actual jump/fall/spring kinematics
   from the spawn point to prove every star, block, secret pipe and the flag are
   reachable.  Ends with "RESULT: PASS" (exit 0) or "RESULT: FAIL" (exit 1).
   A level edit is NOT done until this prints PASS. */
const fs = require('fs');
const problems = [];
const bad = msg => { problems.push(msg); console.log('  [FAIL] ' + msg); };
const warn = msg => console.log('  [warn] ' + msg);

let LEVELS, GRAV, MAX_SPD, JUMP_V, SPRING_V;
try {
  const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
  const lv = html.match(/const LEVELS = (\[[\s\S]*?\n\]);/);
  if (!lv) throw new Error('LEVELS array not found in file');
  LEVELS = eval(lv[1]);
  const num = re => parseFloat(html.match(re)[1]);
  GRAV = num(/GRAV = (-?[\d.]+)/); MAX_SPD = num(/MAX_SPD = (-?[\d.]+)/);
  JUMP_V = num(/JUMP_V = (-?[\d.]+)/); SPRING_V = num(/SPRING_V = (-?[\d.]+)/);
} catch (e) {
  console.log('[FAIL] could not parse game file: ' + e.message);
  console.log('\nRESULT: FAIL (game file unreadable or LEVELS has a syntax error)');
  process.exit(1);
}
const TILE = 32, PW = 20, PH = 30, DT = 1 / 120;
console.log(`physics: JUMP_V=${JUMP_V} (rise ${(JUMP_V * JUMP_V / (2 * GRAV) / 32).toFixed(2)} tiles), spring rise ${(SPRING_V * SPRING_V / (2 * GRAV) / 32).toFixed(2)} tiles, full-jump air distance ${(2 * -JUMP_V / GRAV * MAX_SPD / 32).toFixed(2)} tiles`);

// NOTE: 'W' (castle gate) is solid in-game but NOT here — reachability is
// checked as if King Dad 'G' is already defeated and the gate has crumbled.
const SOLID = new Set(['#', 'x', '=', '?', 'T', 'U', 'B', '(', ')', '[', ']', 'D', 'd', 'S']);
const LEGEND = new Set('#x=?TU*Bo^S()[]DdEVFKRJGWMp, '.split(''));
const GROUND_ENEMIES = new Set(['E', 'K', 'R', 'J', 'G', 'M']); // need a floor below (M = Mum, not an enemy, same rule)
const key = (c, r) => c + ',' + r;

function parseMap(rows) {
  const w = Math.max(...rows.map(r => r.length));
  return { grid: rows.map(r => (r + ' '.repeat(w - r.length)).split('')), w, h: rows.length };
}

/* ---------- structural validation ---------- */
function count(rows, ch) { return rows.join('').split(ch).length - 1; }
function dropLands(rows, c, r) { // does a player placed at (c,r) land on something?
  const { grid, w, h } = parseMap(rows);
  const solid = (cc, rr) => (cc < 0 || cc >= w) ? true : (rr < 0 || rr >= h) ? false : SOLID.has(grid[rr][cc]);
  for (let rr = r; rr < h; rr++) if (solid(c, rr) && !solid(c, rr - 1)) return true;
  return false;
}
function validate(L, i) {
  const tag = `L${i + 1}`;
  for (const f of ['name', 'sub', 'palette', 'music', 'main'])
    if (!L[f]) { bad(`${tag}: missing field '${f}'`); return false; }
  for (const f of ['skyTop', 'skyBot', 'ground', 'groundTop', 'brick', 'hill', 'hill2', 'deco'])
    if (!L.palette[f]) bad(`${tag}: palette missing '${f}'`);
  if (!['grass', 'crystal', 'star'].includes(L.palette.deco)) bad(`${tag}: palette.deco must be grass|crystal|star`);
  if (typeof L.palette.bgStars !== 'boolean') bad(`${tag}: palette.bgStars must be true/false`);
  if (L.palette.weather != null && !['snow', 'embers', 'bubbles'].includes(L.palette.weather)) bad(`${tag}: palette.weather must be snow|embers|bubbles (or omitted)`);
  if (L.palette.ice != null && typeof L.palette.ice !== 'boolean') bad(`${tag}: palette.ice must be true/false (or omitted)`);
  if (!(L.music.bpm >= 60 && L.music.bpm <= 260)) bad(`${tag}: music.bpm out of range`);
  if (!['square', 'triangle', 'sawtooth', 'sine'].includes(L.music.wave)) bad(`${tag}: music.wave invalid`);
  if (typeof L.music.transpose !== 'number') bad(`${tag}: music.transpose must be a number`);
  const grids = [['main', L.main]]; if (L.bonus) grids.push(['bonus', L.bonus]);
  for (const [gname, rows] of grids) {
    if (!Array.isArray(rows) || !rows.every(r => typeof r === 'string')) { bad(`${tag}: ${gname} must be an array of strings`); return false; }
    for (let r = 0; r < rows.length; r++) for (const ch of rows[r])
      if (!LEGEND.has(ch)) { bad(`${tag} ${gname} row ${r}: unknown tile character '${ch}' — only "${[...LEGEND].join('')}" allowed`); break; }
  }
  if (count(L.main, 'p') !== 1) bad(`${tag}: main needs exactly one 'p' spawn (found ${count(L.main, 'p')})`);
  if (count(L.main, 'F') !== 1) bad(`${tag}: main needs exactly one 'F' flag (found ${count(L.main, 'F')})`);
  const hasD = count(L.main, 'D') > 0;
  if (hasD && !(L.bonus && L.bonusSpawn && L.mainReturn))
    bad(`${tag}: has a secret pipe 'D' but bonus/bonusSpawn/mainReturn are not all set`);
  if (!hasD && L.bonus) bad(`${tag}: has a bonus room but no 'Dd' secret pipe in main to enter it`);
  if (L.bonus) {
    if (count(L.bonus, 'D') === 0) bad(`${tag}: bonus room has no 'Dd' exit pipe — player would be trapped`);
    for (const ch of ['p', 'F', 'E', 'V', 'K', 'R', 'J', 'G', 'W', 'M'])
      if (count(L.bonus, ch)) bad(`${tag}: bonus room must not contain '${ch}'`);
    if (!dropLands(L.bonus, L.bonusSpawn[0], L.bonusSpawn[1])) bad(`${tag}: bonusSpawn ${L.bonusSpawn} drops into nothing`);
    if (!dropLands(L.main, L.mainReturn[0], L.mainReturn[1])) bad(`${tag}: mainReturn ${L.mainReturn} drops into nothing`);
  }
  // a 'W' gate only ever opens when King Dad 'G' is defeated — gate without boss = unwinnable
  if (count(L.main, 'W') > 0 && count(L.main, 'G') === 0) bad(`${tag}: has 'W' gate tiles but no 'G' boss to open them`);
  if (count(L.main, 'G') > 1) bad(`${tag}: more than one 'G' boss`);
  if (count(L.main, 'M') > 1) bad(`${tag}: more than one 'M' Mum`);
  // ground enemies (and Mum) need a floor below or they fall out of the world
  const { grid, w, h } = parseMap(L.main);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++)
    if (GROUND_ENEMIES.has(grid[r][c])) {
      let ok = false;
      for (let rr = r + 1; rr < h; rr++) if (SOLID.has(grid[rr][c])) { ok = true; break; }
      if (!ok) warn(`${tag}: '${grid[r][c]}' at col ${c} row ${r} has no floor below (will fall out)`);
    }
  return true;
}

/* ---------- physics reachability (mirrors the game's moveAndCollide) ---------- */
function analyze(name, rows, spawnPos) {
  const { grid, w: GW, h: GH } = parseMap(rows);
  const tileAt = (c, r) => (c < 0 || c >= GW) ? 'x' : (r < 0 || r >= GH) ? ' ' : (grid[r][c] || ' ');
  const solidAt = (c, r) => SOLID.has(tileAt(c, r));

  let spawn = null, flagX = null;
  const stars = [], blocks = [], secretPipes = [];
  for (let r = 0; r < GH; r++) for (let c = 0; c < GW; c++) {
    const ch = grid[r][c];
    if (ch === 'p') { spawn = { c, r: r + 1 }; grid[r][c] = ' '; }
    else if (ch === 'o') stars.push(key(c, r));
    else if ('?TU*'.includes(ch)) blocks.push(key(c, r));
    else if (ch === 'F') flagX = c;
    else if (ch === 'D') secretPipes.push(key(c, r));
  }
  if (spawnPos) spawn = { c: spawnPos[0], r: spawnPos[1] };
  if (!spawn) { bad(`${name}: no spawn`); return {}; }

  const standable = (c, r) => solidAt(c, r) && !solidAt(c, r - 1);
  while (spawn.r < GH && !standable(spawn.c, spawn.r)) spawn.r++;   // game lets the player drop in
  if (spawn.r >= GH) { bad(`${name}: spawn falls straight into a pit`); return {}; }

  function collideMove(p) {
    const bumped = []; let landed = null;
    p.x += p.vx * DT;
    let c0 = Math.floor(p.x / TILE), c1 = Math.floor((p.x + p.w - 0.01) / TILE);
    let r0 = Math.floor(p.y / TILE), r1 = Math.floor((p.y + p.h - 0.01) / TILE);
    if (p.vx > 0) { for (let r = r0; r <= r1; r++) if (solidAt(c1, r)) { p.x = c1 * TILE - p.w; p.vx = 0; break; } }
    else if (p.vx < 0) { for (let r = r0; r <= r1; r++) if (solidAt(c0, r)) { p.x = (c0 + 1) * TILE; p.vx = 0; break; } }
    p.y += p.vy * DT;
    c0 = Math.floor(p.x / TILE); c1 = Math.floor((p.x + p.w - 0.01) / TILE);
    r0 = Math.floor(p.y / TILE); r1 = Math.floor((p.y + p.h - 0.01) / TILE);
    if (p.vy > 0) {
      for (let c = c0; c <= c1; c++) if (solidAt(c, r1)) {
        p.y = r1 * TILE - p.h; p.vy = 0;
        landed = { r: r1, firstC: c, cols: [] };
        for (let cc = c0; cc <= c1; cc++) if (solidAt(cc, r1)) landed.cols.push(cc);
        break;
      }
    } else if (p.vy < 0) {
      let hit = false;
      for (let c = c0; c <= c1; c++) {
        const ch = tileAt(c, r0);
        if (SOLID.has(ch) || ch === '*') { hit = true; bumped.push({ c, r: r0, ch }); }
      }
      if (hit) { p.y = (r0 + 1) * TILE; p.vy = 0; }
    }
    return { bumped, landed };
  }

  function simulate(x0, r, dirA, dirB, doJump, out) {
    const p = { x: x0, y: r * TILE - PH, w: PW, h: PH, vx: 0, vy: doJump ? JUMP_V : 0 };
    let bounces = 0;
    const lands = [];
    for (let t = 0; t < 6; t += DT) {
      p.vy += GRAV * DT; if (p.vy > 900) p.vy = 900;
      p.vx = (p.vy < 0 ? dirA : dirB) * MAX_SPD;
      const res = collideMove(p);
      for (const b of res.bumped) if ('?TU*'.includes(b.ch)) out.bumps.add(key(b.c, b.r));
      const c0 = Math.floor(p.x / TILE), c1 = Math.floor((p.x + p.w) / TILE);
      const r0 = Math.floor(p.y / TILE), r1 = Math.floor((p.y + p.h) / TILE);
      for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++)
        if (tileAt(cc, rr) === 'o') out.stars.add(key(cc, rr));
      if (flagX !== null && p.x + p.w > flagX * TILE + 10) out.flag = true;
      if (res.landed) {
        const gt = tileAt(res.landed.firstC, res.landed.r);
        if (gt === 'S' && bounces < 4) { p.vy = SPRING_V; bounces++; continue; }
        for (const cc of res.landed.cols) lands.push(key(cc, res.landed.r));
        if (doJump || bounces) break;
        if (p.vx === 0) break;              // walk mode: stopped by a wall
      }
      if (p.y > GH * TILE + 60) break;      // pit
    }
    for (const k of lands) out.lands.add(k);
  }

  const visited = new Set(), q = [];
  const out = { stars: new Set(), bumps: new Set(), lands: new Set(), flag: false, secrets: new Set() };
  const push = k => { if (!visited.has(k)) { visited.add(k); q.push(k); } };
  push(key(spawn.c, spawn.r));
  const strategies = [];
  for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) strategies.push([a, b, true]);
  strategies.push([-1, -1, false], [1, 1, false]);
  while (q.length) {
    const [c, r] = q.shift().split(',').map(Number);
    if (!standable(c, r)) continue;
    const ch = tileAt(c, r);
    if (ch === 'D' || ch === 'd') out.secrets.add(key(c, r));
    if (tileAt(c, r - 1) === 'o') out.stars.add(key(c, r - 1));
    if (flagX !== null && (c + 1) * TILE > flagX * TILE + 10) out.flag = true;
    if (standable(c - 1, r)) push(key(c - 1, r));
    if (standable(c + 1, r)) push(key(c + 1, r));
    for (let x = c * TILE - 16; x <= c * TILE + 28; x += 4) {
      const sc0 = Math.floor(x / TILE), sc1 = Math.floor((x + PW - 0.01) / TILE);
      let sup = false, free = true;
      for (let cc = sc0; cc <= sc1; cc++) {
        if (solidAt(cc, r) && !solidAt(cc, r - 1)) sup = true;
        if (solidAt(cc, r - 1)) free = false;
      }
      if (!sup || !free) continue;
      for (const [a, b, j] of strategies) simulate(x, r, a, b, j, out);
    }
    for (const k of out.lands) push(k);
    out.lands.clear();
  }

  const missStars = stars.filter(k => !out.stars.has(k));
  const missBlocks = blocks.filter(k => !out.bumps.has(k));
  const missPipes = secretPipes.filter(k => !out.secrets.has(k));
  console.log(`\n=== ${name} ===  (${GW}x${GH})  reachable standing tiles: ${visited.size}`);
  if (flagX !== null) { if (out.flag) console.log('  flag: reachable'); else bad(`${name}: flag is UNREACHABLE`); }
  if (missStars.length) bad(`${name}: ${missStars.length}/${stars.length} stars unreachable at (col,row): ${missStars.join('  ')}`);
  else console.log(`  stars ${stars.length}/${stars.length} reachable`);
  if (missBlocks.length) bad(`${name}: blocks unbumpable at (col,row): ${missBlocks.map(k => k + '=' + tileAt(...k.split(',').map(Number))).join('  ')}`);
  else console.log(`  blocks ${blocks.length}/${blocks.length} bumpable`);
  if (missPipes.length) bad(`${name}: secret pipe top 'D' unreachable at ${missPipes.join(' ')}`);
  else if (secretPipes.length) console.log('  secret pipe: reachable');
  return out;
}

/* ---------- run ---------- */
if (!Array.isArray(LEVELS) || LEVELS.length === 0) bad('LEVELS is empty');
LEVELS.forEach((L, i) => {
  if (!validate(L, i)) return;
  analyze(`L${i + 1} ${L.name} (main)`, L.main, null);
  if (L.bonus) analyze(`L${i + 1} ${L.name} (bonus)`, L.bonus, L.bonusSpawn);
});
if (problems.length) { console.log(`\nRESULT: FAIL (${problems.length} problem(s) — fix them and re-run)`); process.exit(1); }
console.log('\nRESULT: PASS');
