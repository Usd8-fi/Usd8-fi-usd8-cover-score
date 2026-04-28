/** Qualifying-token registry. Admin edits this map; algo reads it. v1 = code config; V2 = onchain admin-keyed registry. */

import type { TokenRegistry } from "./types.js";

/** Default registry — dummy tokens for v1 pipeline validation. Replace with real USD8 token addresses. */
export const DEFAULT_REGISTRY: TokenRegistry = {
  chainId: 1,
  tokens: [
    {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      symbol: "USDC",
      decimals: 6,
      weight: 1.0,
      kind: "raw",
      notes: "DUMMY v1: stand-in for raw USD8. Replace with USD8 token address.",
    },
    {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      symbol: "USDT",
      decimals: 6,
      weight: 0.7,
      kind: "staked",
      notes: "DUMMY v1: stand-in for staked USD8. Replace with stUSD8 address.",
    },
  ],
};

export function loadRegistry(): TokenRegistry {
  return DEFAULT_REGISTRY;
}
