# SimpleRPG Recovery / v61

## Purpose
The original SimpleRPG source is recovered into the cumulative MIKI artifact as a read-only reference asset.

## Boundary
- Source files are stored under `reference/simple-rpg/`.
- They are not imported into the MIKI runtime.
- They are not registered as VERIFIED components.
- They cannot become executable MIKI capabilities merely by being referenced.
- The adapter only indexes deterministic capability areas and records reference usage.

## Recovered capability areas
- combat / enemy skills
- gathering / gathering bases
- crafting / cooking
- equipment / enhancement / repair
- farming / fishing
- pets
- guild / jobs / skills
- market / buy-sell
- housing
- save/load
- Teto automated test player

## Runtime integration
`simpleRpgReferenceService` is consulted during deterministic request planning. When a prompt clearly matches a SimpleRPG capability, MIKI records the reference and adds a planning note. Execution still requires the normal VERIFIED component, composition, risk, artifact, and runner gates.

This prevents legacy browser-global game code from becoming an accidental runtime dependency while retaining the useful original implementation as an inspectable source asset.
