import { describe, it, expect } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  signCoverScore,
  verifyCoverScoreSignature,
  rawWeightToScaled,
} from "../src/sign.js";
import type { CoverScoreResult } from "../src/types.js";

const sampleResult = (overrides: Partial<CoverScoreResult> = {}): CoverScoreResult => ({
  holder: "0x2222222222222222222222222222222222222222",
  asofBlock: 18_000_000n,
  asofBlockHash:
    "0x1111111111111111111111111111111111111111111111111111111111111111",
  asofTimestamp: 1_700_000_000n,
  chainId: 1,
  contributions: [],
  rawWeight: 12345.6789,
  ...overrides,
});

describe("rawWeightToScaled", () => {
  it("scales a small float to fixed-point bigint", () => {
    expect(rawWeightToScaled(1)).toBe(1_000_000_000_000_000_000n);
  });

  it("rounds correctly", () => {
    // 0.5 * 1e18 = 5e17
    expect(rawWeightToScaled(0.5)).toBe(500_000_000_000_000_000n);
  });

  it("returns zero for zero", () => {
    expect(rawWeightToScaled(0)).toBe(0n);
  });

  it("throws on negative input", () => {
    expect(() => rawWeightToScaled(-1)).toThrow(/negative/);
  });

  it("throws on non-finite input", () => {
    expect(() => rawWeightToScaled(NaN)).toThrow(/finite/);
    expect(() => rawWeightToScaled(Infinity)).toThrow(/finite/);
  });

  it("throws on values too large to scale safely", () => {
    expect(() => rawWeightToScaled(1e19)).toThrow(/too large/);
  });
});

describe("signCoverScore + verifyCoverScoreSignature", () => {
  it("roundtrips: sign then verify returns true", async () => {
    const privateKey = generatePrivateKey();
    const result = sampleResult();
    const signed = await signCoverScore(result, privateKey);
    const ok = await verifyCoverScoreSignature(signed);
    expect(ok).toBe(true);
  });

  it("verify returns true with explicit verifyingContract domain match", async () => {
    const privateKey = generatePrivateKey();
    const verifyingContract = "0x4444444444444444444444444444444444444444" as const;
    const result = sampleResult();
    const signed = await signCoverScore(result, privateKey, verifyingContract);
    const ok = await verifyCoverScoreSignature(signed, verifyingContract);
    expect(ok).toBe(true);
  });

  it("verify returns false when verifyingContract differs (domain separation)", async () => {
    const privateKey = generatePrivateKey();
    const verifyingContractA = "0x5555555555555555555555555555555555555555" as const;
    const verifyingContractB = "0x6666666666666666666666666666666666666666" as const;
    const result = sampleResult();
    const signed = await signCoverScore(result, privateKey, verifyingContractA);
    const ok = await verifyCoverScoreSignature(signed, verifyingContractB);
    expect(ok).toBe(false);
  });

  it("signer address is the public key derived from the private key", async () => {
    const privateKey = generatePrivateKey();
    const expected = privateKeyToAccount(privateKey).address;
    const signed = await signCoverScore(sampleResult(), privateKey);
    expect(signed.signerAddress.toLowerCase()).toBe(expected.toLowerCase());
  });

  it("changing rawWeight invalidates the signature", async () => {
    const privateKey = generatePrivateKey();
    const result = sampleResult({ rawWeight: 100 });
    const signed = await signCoverScore(result, privateKey);
    // Tamper with the result post-signing.
    const tampered = {
      ...signed,
      result: { ...signed.result, rawWeight: 200 },
    };
    const ok = await verifyCoverScoreSignature(tampered);
    expect(ok).toBe(false);
  });

  it("changing chainId invalidates the signature (anti-replay across chains)", async () => {
    const privateKey = generatePrivateKey();
    const signed = await signCoverScore(sampleResult({ chainId: 1 }), privateKey);
    const tampered = {
      ...signed,
      result: { ...signed.result, chainId: 137 },
    };
    const ok = await verifyCoverScoreSignature(tampered);
    expect(ok).toBe(false);
  });

  it("changing asofBlockHash invalidates the signature (anti-replay)", async () => {
    const privateKey = generatePrivateKey();
    const signed = await signCoverScore(sampleResult(), privateKey);
    const tampered = {
      ...signed,
      result: {
        ...signed.result,
        asofBlockHash:
          "0x2222222222222222222222222222222222222222222222222222222222222222" as const,
      },
    };
    const ok = await verifyCoverScoreSignature(tampered);
    expect(ok).toBe(false);
  });
});
