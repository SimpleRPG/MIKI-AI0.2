# Reviewed merge v123

Base master: ビービー Ver120.
Incoming diff: MIKI-AI0.2-main_priority3-5-6_diff-only-v122.zip.txt.

Integrated:
- Priority 3 implementation record.
- Priority 5 external feedback intake extensions.
- Priority 6 learning impact and artifact suspension extensions.
- Typed improvement UI commands for feedback import and review decisions.

Corrections made during review:
- Removed duplicate `claims` object property and references to undefined `lines`.
- Added missing `externalAiRole` to persisted review decisions.
- Mapped PARTIAL_ACCEPT and PARTIAL_REJECT to correction learning instead of HOLD.
- Preserved existing candidate generator because the diff manifest states it is byte-identical.
- Preserved existing Priority 13 and 14 master changes.

Not claimed:
- Full TypeScript build.
- Vite or APK build.
- Galaxy S25 runtime E2E.
