import { describe, it, expect } from "vitest";
import { buildSegments, type TransferLog } from "../src/balance-timeline.js";
import type { Address } from "viem";

const TOKEN: Address = "0x1111111111111111111111111111111111111111";
const HOLDER: Address = "0x2222222222222222222222222222222222222222";
const OTHER: Address = "0x3333333333333333333333333333333333333333";

const transfer = (overrides: Partial<TransferLog>): TransferLog => ({
  blockNumber: 0n,
  blockTimestamp: 0n,
  from: OTHER,
  to: HOLDER,
  value: 0n,
  ...overrides,
});

describe("buildSegments", () => {
  it("returns no segments for empty transfers", () => {
    expect(buildSegments(TOKEN, HOLDER, [], 1000n, 86400n)).toEqual([]);
  });

  it("creates one segment for a single inbound transfer running to asof", () => {
    const segs = buildSegments(
      TOKEN,
      HOLDER,
      [transfer({ blockNumber: 100n, blockTimestamp: 1000n, value: 500n })],
      200n,
      2000n
    );
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({
      balance: 500n,
      startTimestamp: 1000n,
      endTimestamp: 2000n,
      durationSeconds: 1000n,
    });
  });

  it("ends a segment at the next event and starts a new one with updated balance", () => {
    const segs = buildSegments(
      TOKEN,
      HOLDER,
      [
        transfer({ blockNumber: 100n, blockTimestamp: 1000n, value: 500n }),
        transfer({ blockNumber: 200n, blockTimestamp: 2000n, value: 300n }),
      ],
      300n,
      3000n
    );
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({
      balance: 500n,
      startTimestamp: 1000n,
      endTimestamp: 2000n,
      durationSeconds: 1000n,
    });
    expect(segs[1]).toMatchObject({
      balance: 800n,
      startTimestamp: 2000n,
      endTimestamp: 3000n,
      durationSeconds: 1000n,
    });
  });

  it("handles outbound transfers reducing balance", () => {
    const segs = buildSegments(
      TOKEN,
      HOLDER,
      [
        transfer({ blockNumber: 100n, blockTimestamp: 1000n, value: 1000n }),
        transfer({
          blockNumber: 200n,
          blockTimestamp: 2000n,
          from: HOLDER,
          to: OTHER,
          value: 400n,
        }),
      ],
      300n,
      3000n
    );
    expect(segs).toHaveLength(2);
    expect(segs[0]?.balance).toBe(1000n);
    expect(segs[1]?.balance).toBe(600n);
  });

  it("skips zero-balance segments after full withdrawal", () => {
    const segs = buildSegments(
      TOKEN,
      HOLDER,
      [
        transfer({ blockNumber: 100n, blockTimestamp: 1000n, value: 1000n }),
        transfer({
          blockNumber: 200n,
          blockTimestamp: 2000n,
          from: HOLDER,
          to: OTHER,
          value: 1000n,
        }),
      ],
      300n,
      3000n
    );
    // Only one positive-balance segment from t=1000 to t=2000.
    expect(segs).toHaveLength(1);
    expect(segs[0]?.balance).toBe(1000n);
  });

  it("throws on negative balance (malformed transfer log)", () => {
    expect(() =>
      buildSegments(
        TOKEN,
        HOLDER,
        [
          transfer({
            blockNumber: 100n,
            blockTimestamp: 1000n,
            from: HOLDER,
            to: OTHER,
            value: 500n, // outbound without prior balance
          }),
        ],
        200n,
        2000n
      )
    ).toThrow(/negative balance/i);
  });

  it("self-transfers (holder→holder) net to zero balance change", () => {
    const segs = buildSegments(
      TOKEN,
      HOLDER,
      [
        transfer({ blockNumber: 100n, blockTimestamp: 1000n, value: 500n }),
        transfer({
          blockNumber: 200n,
          blockTimestamp: 2000n,
          from: HOLDER,
          to: HOLDER,
          value: 100n,
        }),
      ],
      300n,
      3000n
    );
    // Both segments have balance 500.
    expect(segs).toHaveLength(2);
    expect(segs[0]?.balance).toBe(500n);
    expect(segs[1]?.balance).toBe(500n);
  });

  it("respects checksum normalization on holder addresses", () => {
    // Lowercased holder address (viem's getAddress normalizes both sides).
    const lowerHolder = HOLDER as Address;
    const segs = buildSegments(
      TOKEN,
      lowerHolder,
      [transfer({ blockNumber: 100n, blockTimestamp: 1000n, to: HOLDER, value: 1000n })],
      200n,
      2000n
    );
    expect(segs).toHaveLength(1);
    expect(segs[0]?.balance).toBe(1000n);
  });
});
