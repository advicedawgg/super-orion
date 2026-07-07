---
description: Add a new verified level to Super Orion
---

Add ONE new level to Super Orion with this theme: $ARGUMENTS

Follow AGENTS.md in this folder exactly. Steps, in order:

1. Read AGENTS.md fully. Read the LEVELS array in index.html and study the "Soda Springs" level as your reference for structure and difficulty.
2. Copy levelgen.template.js to levelgen-work.js. Edit ONLY the CONFIG and PLACEMENTS sections to build the themed level. Do not hand-type any map row.
3. Run: node levelgen-work.js
4. Paste the printed level object into the LEVELS array in index.html, immediately above the final `];`.
5. Run: node levelcheck.js index.html
   - If it prints any [FAIL] line, fix placements in levelgen-work.js, re-run it, re-paste the level (replacing your previous attempt), and re-check. Repeat until it ends with RESULT: PASS.
6. Update the level list line in README.md to include the new level name.
7. Delete levelgen-work.js.

You are NOT done until levelcheck.js prints RESULT: PASS with the new level included. Show the full checker output in your final answer. Never modify engine code, physics constants, or existing levels.
