import { describe, it, expect } from "vitest";
import { integrateRaw, normalizeIntegral } from "../src/integrate.js";
import type { BalanceSegment } from "../src/types.js";

const seg = (balance: bigint, durationSeconds: bigint): BalanceSegment => ({
  token: "0x0000000000000000000000000000000000000000",
  balance,
  startBlock: 0n,
  startTimestamp: 0n,
  endBlock: 0n,
  endTimestamp: durationSeconds,
  durationSeconds,
});

describe("integrateRaw", () => {
  it("returns 0 for empty segments", () => {
    expect(integrateRaw([])).toBe(0n);
  });

  it("computes balance × duration for a single segment", () => {
    expect(integrateRaw([seg(100n, 60n)])).toBe(6000n);
  });

  it("sums across multiple segments", () => {
    expect(integrateRaw([seg(100n, 60n), seg(200n, 30n)])).toBe(12000n);
  });

  it("handles zero-balance segments cleanly", () => {
    expect(integrateRaw([seg(0n, 1000n), seg(50n, 10n)])).toBe(500n);
  });
});

describe("normalizeIntegral", () => {
  it("scales by 10^decimals", () => {
    // 1e6 base-units × 86400s = 8.64e10 → / 1e6 = 86400 token-seconds
    expect(normalizeIntegral(86400_000_000n, 6)).toBeCloseTo(86400);
  });

  it("preserves sub-unit precision when small", () => {
    // 0.5 token × 100s with 6 decimals = 500_000 × 100 = 50_000_000
    expect(normalizeIntegral(50_000_000n, 6)).toBeCloseTo(50);
  });

  it("returns 0 for zero integral", () => {
    expect(normalizeIntegral(0n, 18)).toBe(0);
  });
});
