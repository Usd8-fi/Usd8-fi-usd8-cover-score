/** Orchestrator. Composes registry × balance-timeline × integrate → wᵢ. Deterministic given (registry, holder, asof-block, RPC). */

import { getAddress, type Address, type PublicClient } from "viem";
import type { CoverScoreResult, TokenContribution, TokenRegistry } from "./types.js";
import { buildSegments, fetchBalanceAt, fetchTransfers } from "./balance-timeline.js";
import { integrateRaw, normalizeIntegral } from "./integrate.js";

export async function computeCoverScore(
  client: PublicClient,
  registry: TokenRegistry,
  holder: Address,
  asofBlock: bigint,
  opts: { fromBlock?: bigint; chunkBlocks?: bigint } = {}
): Promise<CoverScoreResult> {
  const h = getAddress(holder);
  const block = await client.getBlock({ blockNumber: asofBlock });
  if (!block.hash) throw new Error(`asof block ${asofBlock} has no hash (pending?)`);

  const fromBlock = opts.fromBlock ?? 0n;
  const fromTs = fromBlock === 0n ? 0n : (await client.getBlock({ blockNumber: fromBlock })).timestamp;

  const contributions: TokenContribution[] = await Promise.all(
    registry.tokens.map(async (token) => {
      const addr = getAddress(token.address);
      const [transfers, initialBalance] = await Promise.all([
        fetchTransfers(client, addr, h, asofBlock, opts),
        fromBlock > 0n ? fetchBalanceAt(client, addr, h, fromBlock) : Promise.resolve(0n),
      ]);
      const segments = buildSegments(addr, h, transfers, asofBlock, block.timestamp, initialBalance, fromTs);
      const rawIntegral = integrateRaw(segments);
      const weighted = normalizeIntegral(rawIntegral, token.decimals) * token.weight;
      return { token: addr, symbol: token.symbol, segments, rawIntegral, decimals: token.decimals, weight: token.weight, weighted };
    })
  );

  return {
    holder: h, asofBlock, asofBlockHash: block.hash, asofTimestamp: block.timestamp,
    chainId: registry.chainId, contributions,
    rawWeight: contributions.reduce((s, c) => s + c.weighted, 0),
  };
}
