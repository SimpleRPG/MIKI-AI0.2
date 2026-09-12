MIKI-AI0.2 v77 - Counterexample-Driven Contract Refinement

Design alignment: Master Specification chapters 125, 128, 142, 145, 159, 160, 161, 163, 172.

Failure evidence can now produce a minimal deterministic contract candidate. The candidate is never treated as a finalized specification automatically. Broad/unsafe candidates enter QUARANTINED. PROPOSED candidates require normal-case, compatibility and regression evidence before VALIDATED. Final specification promotion remains a separate gate.

No arbitrary code generation, eval, new Function, Math.random, direct component mutation, or automatic VERIFIED promotion.
