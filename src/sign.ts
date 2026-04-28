/** EIP-712 typed-data signing for cover-score payloads. Solidity-side verification via ecrecover. Anti-replay: chainId + asofBlockHash bound into the domain/message. */

import { type Address, type Hex, type TypedDataDomain, recoverTypedDataAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { CoverScoreResult, SignedCoverScore } from "./types.js";

export const EIP712_DOMAIN_NAME = "USD8 Cover Score";
export const EIP712_DOMAIN_VERSION = "1";

export const EIP712_TYPES = {
  CoverScore: [
    { name: "holder", type: "address" },
    { name: "chainId", type: "uint256" },
    { name: "asofBlock", type: "uint256" },
    { name: "asofBlockHash", type: "bytes32" },
    { name: "asofTimestamp", type: "uint256" },
    { name: "rawWeightScaled", type: "uint256" },
  ],
} as const;

/** Scale a JS-number raw weight to bigint fixed-point (1e18). Throws on non-finite, negative, or oversize. */
export function rawWeightToScaled(rawWeight: number): bigint {
  if (!Number.isFinite(rawWeight)) throw new Error(`rawWeight not finite: ${rawWeight}`);
  if (rawWeight < 0) throw new Error(`rawWeight negative: ${rawWeight}`);
  if (rawWeight > 1e18) throw new Error(`rawWeight too large for safe scaling: ${rawWeight}`);
  return BigInt(Math.round(rawWeight * 1_000_000_000_000)) * 1_000_000n;
}

export function buildDomain(chainId: number, verifyingContract?: Address): TypedDataDomain {
  return {
    name: EIP712_DOMAIN_NAME,
    version: EIP712_DOMAIN_VERSION,
    chainId,
    ...(verifyingContract ? { verifyingContract } : {}),
  };
}

export function buildMessage(result: CoverScoreResult) {
  return {
    holder: result.holder,
    chainId: BigInt(result.chainId),
    asofBlock: result.asofBlock,
    asofBlockHash: result.asofBlockHash,
    asofTimestamp: result.asofTimestamp,
    rawWeightScaled: rawWeightToScaled(result.rawWeight),
  };
}

export async function signCoverScore(result: CoverScoreResult, privateKey: Hex, verifyingContract?: Address): Promise<SignedCoverScore> {
  const account = privateKeyToAccount(privateKey);
  const signature = await account.signTypedData({
    domain: buildDomain(result.chainId, verifyingContract),
    types: EIP712_TYPES,
    primaryType: "CoverScore",
    message: buildMessage(result),
  });
  return { result, signature, signerAddress: account.address };
}

export async function verifyCoverScoreSignature(signed: SignedCoverScore, verifyingContract?: Address): Promise<boolean> {
  const recovered = await recoverTypedDataAddress({
    domain: buildDomain(signed.result.chainId, verifyingContract),
    types: EIP712_TYPES,
    primaryType: "CoverScore",
    message: buildMessage(signed.result),
    signature: signed.signature,
  });
  return recovered.toLowerCase() === signed.signerAddress.toLowerCase();
}
