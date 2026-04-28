/** Build per-token balance timeline from chain Transfer events. Deterministic given (token, holder, asof-block). RPC-bound. Chunked log fetching. Negative-balance guard. */

import type { Address, PublicClient } from "viem";
import { getAddress, parseAbi, parseAbiItem } from "viem";
import type { BalanceSegment } from "./types.js";

const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const ERC20_BALANCE_ABI = parseAbi(["function balanceOf(address account) view returns (uint256)"]);

export const DEFAULT_CHUNK_BLOCKS = 10_000n;

export type TransferLog = {
  blockNumber: bigint;
  blockTimestamp: bigint;
  from: Address;
  to: Address;
  value: bigint;
};

/** balanceOf(holder) at a historical block. Returns 0 if RPC pruned state or token predates block. */
export async function fetchBalanceAt(client: PublicClient, token: Address, holder: Address, blockNumber: bigint): Promise<bigint> {
  try {
    return await client.readContract({ address: token, abi: ERC20_BALANCE_ABI, functionName: "balanceOf", args: [holder], blockNumber });
  } catch {
    return 0n;
  }
}

/** Fetch all Transfer logs touching `holder` on `token` in chunks. Sorted by block. */
export async function fetchTransfers(
  client: PublicClient,
  token: Address,
  holder: Address,
  asofBlock: bigint,
  opts: { fromBlock?: bigint; chunkBlocks?: bigint } = {}
): Promise<TransferLog[]> {
  const fromBlock = opts.fromBlock ?? 0n;
  const chunkSize = opts.chunkBlocks ?? DEFAULT_CHUNK_BLOCKS;
  const h = getAddress(holder);

  const logs: Array<{ blockNumber: bigint | null; args: { from?: Address | undefined; to?: Address | undefined; value?: bigint | undefined } }> = [];
  for (let cursor = fromBlock; cursor <= asofBlock; cursor += chunkSize + 1n) {
    const end = cursor + chunkSize > asofBlock ? asofBlock : cursor + chunkSize;
    const [out, inc] = await Promise.all([
      client.getLogs({ address: token, event: TRANSFER_EVENT, args: { from: h }, fromBlock: cursor, toBlock: end }),
      client.getLogs({ address: token, event: TRANSFER_EVENT, args: { to: h }, fromBlock: cursor, toBlock: end }),
    ]);
    logs.push(...out, ...inc);
  }

  const blockNumbers = Array.from(new Set(logs.map((l) => l.blockNumber!)));
  const blocks = await Promise.all(blockNumbers.map((bn) => client.getBlock({ blockNumber: bn })));
  const tsByBlock = new Map(blocks.map((b) => [b.number!, b.timestamp]));

  return logs
    .map((l) => ({ blockNumber: l.blockNumber!, blockTimestamp: tsByBlock.get(l.blockNumber!)!, from: l.args.from!, to: l.args.to!, value: l.args.value! }))
    .sort((a, b) => (a.blockNumber === b.blockNumber ? 0 : a.blockNumber < b.blockNumber ? -1 : 1));
}

/**
 * Build constant-balance segments. `initialBalance` = holder's balance at `fromBlock` for partial scans; 0n when scanning from genesis.
 * Throws on negative balance (malformed log, out-of-order, or wrong initialBalance).
 */
export function buildSegments(
  token: Address,
  holder: Address,
  transfers: TransferLog[],
  asofBlock: bigint,
  asofTimestamp: bigint,
  initialBalance: bigint = 0n,
  fromBlockTimestamp: bigint = 0n
): BalanceSegment[] {
  const segments: BalanceSegment[] = [];
  const h = getAddress(holder);
  let balance = initialBalance;

  if (initialBalance > 0n) {
    const endTs = transfers[0]?.blockTimestamp ?? asofTimestamp;
    if (endTs > fromBlockTimestamp) {
      segments.push({
        token, balance: initialBalance,
        startBlock: 0n, startTimestamp: fromBlockTimestamp,
        endBlock: transfers[0]?.blockNumber ?? asofBlock, endTimestamp: endTs,
        durationSeconds: endTs - fromBlockTimestamp,
      });
    }
  }

  for (let i = 0; i < transfers.length; i++) {
    const t = transfers[i]!;
    if (getAddress(t.from) === h) balance -= t.value;
    if (getAddress(t.to) === h) balance += t.value;
    if (balance < 0n) throw new Error(`negative balance for ${h} on ${token} at block ${t.blockNumber}: ${balance} (malformed log, out-of-order, or wrong initialBalance)`);

    const next = transfers[i + 1];
    const endBlock = next?.blockNumber ?? asofBlock;
    const endTs = next?.blockTimestamp ?? asofTimestamp;
    if (balance > 0n && endTs > t.blockTimestamp) {
      segments.push({
        token, balance,
        startBlock: t.blockNumber, startTimestamp: t.blockTimestamp,
        endBlock, endTimestamp: endTs,
        durationSeconds: endTs - t.blockTimestamp,
      });
    }
  }
  return segments;
}
