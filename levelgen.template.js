'use strict';
/* ================================================================
   LEVEL GENERATOR TEMPLATE for Super Orion
   Never type map rows by hand — spaces WILL be miscounted.
   1. Copy this file to levelgen-work.js
   2. Edit the CONFIG and PLACEMENTS sections only
   3. Run:  node levelgen-work.js
   4. Paste the printed level object into the LEVELS array in
      index.html, just above the final `];`
   5. Run:  node levelcheck.js index.html   → must print RESULT: PASS
   ================================================================ */

/* ---------------- CONFIG (edit me) ---------------- */
const NAME = 'My New Level';        // shown on the start card
const SUB  = 'World 1-6';           // world number — next unused one
const WIDTH = 120;                  // level width in tiles (110-135 is good)
const PALETTE = {                   // pick pleasant hex colors for the theme
  skyTop:'#7ec4f8', skyBot:'#d9f4ff',   // sky gradient
  ground:'#a9703f', groundTop:'#58c443',// dirt + surface strip
  brick:'#c75b39',                      // breakable '=' bricks
  hill:'#7ed27a', hill2:'#5cb85c',      // parallax hills
  deco:'grass',                         // 'grass' | 'crystal' | 'star'
  bgStars:false,                        // true = night sky
};
const MUSIC = { bpm:150, transpose:0, wave:'square' }; // wave: square|triangle|sawtooth|sine

/* ---------------- helpers (do not edit) ---------------- */
const rows = Array.from({ length: 17 }, () => ' '.repeat(WIDTH));
function put(r, c, s) { rows[r] = rows[r].slice(0, c) + s + rows[r].slice(c + s.length); }
function ground(spans) { // spans: [[startCol, endCol], ...] — everything between spans is a death pit
  let g = ' '.repeat(WIDTH);
  for (const [a, b] of spans) g = g.slice(0, a) + '#'.repeat(b - a + 1) + g.slice(b + 1);
  rows[15] = g; rows[16] = g.replace(/#/g, 'x');
}

/* ---------------- PLACEMENTS (edit me) ----------------
   Grid: 17 rows (0=top … 15=ground surface, 16=underground), col 0..WIDTH-1.
   RULES THAT KEEP IT PLAYABLE (jump reaches 4.5 tiles up, ~6 tiles across):
   - ledges/platforms: climb at most 4 rows per jump (3 is comfy), gaps <= 4 cols
   - ?/T/U blocks: put them on row 11 over ground (bump AND stand both work)
   - stars 'o': rows 12-13 over ground = easy hops; above platforms = walk-collect
   - springs 'S': launch ~6 rows up; NEVER put solid tiles directly above a spring
   - enemies: 'E' on row 14 (stands on ground), 'V' flies around rows 9-12
   - spawn 'p' near col 3; flag 'F' on row 14 near the right end, ground under it
   - keep the first 8 cols free of enemies, spikes and pits
   Example placements below — REPLACE them with your design: */
ground([[0, 13], [16, 40], [44, WIDTH - 1]]);   // two pits: 14-15 and 41-43
put(14, 3, 'p');
put(11, 20, '?o?');
put(8, 21, 'o');
put(14, 24, 'E');
put(13, 30, 'ooo');
put(11, 34, 'T');
put(14, 50, 'S');
put(8, 53, '####'); put(7, 54, 'oo');
put(14, 60, 'E');
put(14, 70, ',');
put(14, WIDTH - 8, 'F');

/* ---------------- output (do not edit) ---------------- */
function ruler(w) {
  let a = '', b = '';
  for (let i = 0; i < w; i++) { a += i % 10 === 0 ? String(i / 10 % 10) : ' '; b += i % 10; }
  return a + '\n' + b;
}
console.log('Preview with column ruler:');
console.log(ruler(WIDTH));
rows.forEach((r, i) => console.log(String(i).padStart(2) + '|' + r + '|'));
console.log('\nPaste this into LEVELS in index.html (before the final `];`):\n');
console.log('{');
console.log(`  name:'${NAME}', sub:'${SUB}',`);
console.log(`  palette:{ skyTop:'${PALETTE.skyTop}', skyBot:'${PALETTE.skyBot}', ground:'${PALETTE.ground}', groundTop:'${PALETTE.groundTop}', brick:'${PALETTE.brick}',`);
console.log(`            hill:'${PALETTE.hill}', hill2:'${PALETTE.hill2}', deco:'${PALETTE.deco}', bgStars:${PALETTE.bgStars} },`);
console.log(`  music:{ bpm:${MUSIC.bpm}, transpose:${MUSIC.transpose}, wave:'${MUSIC.wave}' },`);
console.log('  main:[');
rows.forEach(r => console.log("'" + r + "',"));
console.log('  ],');
console.log('  bonus:null, bonusSpawn:null, mainReturn:null,');
console.log('},');
console.log('\nNOW RUN:  node levelcheck.js index.html   (must print RESULT: PASS)');
