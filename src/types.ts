import type { Address, Hex } from "viem";

/**
 * A token that contributes to cover score. `kind` is an open-ended admin label;
 * v1 handles ERC-20-Transfer-event semantics regardless of label — non-standard
 * tokens (rebasing, fee-on-transfer, non-EVM) require adapter-pattern revision.
 */
export type QualifyingToken = {
  address: Address;
  symbol: string;
  decimals: number;
  weight: number;
  kind: string;
  notes?: string;
};

export type TokenRegistry = {
  chainId: number;
  tokens: QualifyingToken[];
};

/** Constant-balance interval between two events for one token. */
export type BalanceSegment = {
  token: Address;
  balance: bigint;
  startBlock: bigint;
  startTimestamp: bigint;
  endBlock: bigint;
  endTimestamp: bigint;
  durationSeconds: bigint;
};

/** Per-token weighted contribution to a holder's raw weight wᵢ. */
export type TokenContribution = {
  token: Address;
  symbol: string;
  segments: BalanceSegment[];
  rawIntegral: bigint;
  decimals: number;
  weight: number;
  weighted: number;
};

/** Holder's cover-score result. rawWeight = wᵢ. score = φᵢ when v(N) and Σⱼ wⱼ are known. */
export type CoverScoreResult = {
  holder: Address;
  asofBlock: bigint;
  asofBlockHash: Hex;
  asofTimestamp: bigint;
  chainId: number;
  contributions: TokenContribution[];
  rawWeight: number;
  score?: number;
  poolReserve?: bigint;
  globalDenominator?: number;
};

/** Signed payload submitted to the claim contract. */
export type SignedCoverScore = {
  result: CoverScoreResult;
  signature: Hex;
  signerAddress: Address;
};
