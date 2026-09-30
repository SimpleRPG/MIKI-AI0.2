# MIKI Native Core

This crate is the fixed native execution boundary for deterministic, heavy operations.
Phase 1 exposes only ABI health checks. Future operations must be registered in the
TypeScript `NativeOperationKind` union and implemented without arbitrary code or shell execution.

Android libraries are built explicitly with `scripts/build_rust_android.sh` and copied to
`android/app/src/main/jniLibs`. If the library is absent, the Kotlin bridge fails closed and
MIKI continues on the verified TypeScript/Kotlin path.
