// Product-level toggles that aren't per-environment config (see shared/env.ts
// for that). At launch the platform is fully free — every new user gets an
// automatic trial access pass (see modules/access-passes/service.ts) instead
// of buying one — so all price/purchase UI stays hidden until this flips.
export const PRICING_ENABLED = false;
