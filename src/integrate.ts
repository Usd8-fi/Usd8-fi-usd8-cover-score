/** Time-weighted integration over balance segments. Pure functional reduction. */

import type { BalanceSegment } from "./types.js";

/** Σ over segments of (balance * duration). Returns raw integral as bigint (token-base-units × seconds). */
export function integrateRaw(segments: BalanceSegment[]): bigint {
  let total = 0n;
  for (const s of segments) {
    total += s.balance * s.durationSeconds;
  }
  return total;
}

/** Normalize raw integral to a number, scaled by token decimals. Returns balance-units × seconds as a JS number. */
export function normalizeIntegral(rawIntegral: bigint, decimals: number): number {
  const scale = 10n ** BigInt(decimals);
  // Scale down to whole-token-seconds, then to JS number.
  // For long durations this can exceed Number.MAX_SAFE_INTEGER; use bigint division and accept seconds-resolution loss only for huge values.
  const wholeTokenSeconds = rawIntegral / scale;
  const remainder = rawIntegral % scale;
  return Number(wholeTokenSeconds) + Number(remainder) / Number(scale);
}
