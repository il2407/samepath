// Vitest runs modules through plain Node resolution, not Next.js's
// "react-server" bundler condition, so the real `server-only` package
// (which throws unconditionally under that resolution) would blow up any
// test that imports server-only-marked domain code. vitest.config.ts
// aliases `server-only` to this no-op so those modules load normally in
// tests while the real package still guards them at build/runtime in the
// actual app.
export {};
