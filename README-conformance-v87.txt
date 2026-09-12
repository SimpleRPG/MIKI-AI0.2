MIKI-AI0.2 v87 — research/causal/knowledge integration

Implemented:
- Chapter 55/57/62 bridge: admissible research evidence and claims are mirrored into Knowledge OS.
- Claim status is preserved; missing evidence prevents KOS ingestion.
- Research remains acquisition + verification bounded; no search result is treated as truth.
- Chapter 58 causal investigation now tracks falsifiers, orders low-impact tests first, and rejects low-weight hypotheses.
- APIs for KOS claim ingestion and causal investigation/test planning.

Validation:
- scripts/test_conformance_v87.mjs: 8/8 PASS
- local LLM runtime remains removed/non-LLM-only.
