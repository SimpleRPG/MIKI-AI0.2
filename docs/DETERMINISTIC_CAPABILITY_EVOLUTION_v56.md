# v56 Deterministic Capability Evolution

## Goal

Self-improvement no longer means changing model weights. Verified experience is compiled into deterministic capability state.

## Pipeline

`failure/feedback -> safety gate -> review/approval -> verification -> capability patch -> capability mastery -> regression observation`

A sample that is not verified is never treated as an executable capability patch.

## Capability Patch

Each patch records:

- capability identifier
- source sample
- deterministic trigger keywords
- explicit rule text
- verification state
- creation timestamp

Duplicate patches are rejected by signature.

## Runtime boundary

The execution path remains Non-LLM Core. External teacher output can supply evidence, but it is not automatically promoted into executable behavior.

## Structural budget

The context budget service now represents structural execution budget rather than model context capacity. Thermal and battery constraints still reduce work depth, but no model-size or KV-cache calculation is required.
