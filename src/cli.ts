#!/usr/bin/env node
/** CLI for cover-score. Usage: cover-score --user 0x... --asof <block> --rpc <url> [--sign-key <hex>] */

import { Command } from "commander";
import { createPublicClient, http, isAddress, isHex, type Address, type Hex } from "viem";
import { mainnet } from "viem/chains";
import { computeCoverScore } from "./cover-score.js";
import { loadRegistry } from "./registry.js";
import { signCoverScore } from "./sign.js";

const program = new Command();

program
  .name("cover-score")
  .description("Compute USD8 Cover Score for a holder against onchain data.")
  .requiredOption("-u, --user <address>", "holder address (0x...)")
  .requiredOption("-a, --asof <block>", "asof block number (decimal or 'latest')")
  .option("-f, --from-block <block>", "starting block for history scan (default: 0; set to USD8 deployment block in production)", "0")
  .option("-c, --chunk-blocks <n>", "blocks per getLogs chunk (default: 10000; lower if your RPC caps log queries)", "10000")
  .option("-r, --rpc <url>", "RPC URL", process.env.RPC_URL ?? "https://eth.llamarpc.com")
  .option("-k, --sign-key <hex>", "ECDSA private key for signing (env SIGN_KEY)", process.env.SIGN_KEY)
  .option("--no-sign", "skip signing, output unsigned result");

program.parse();
const opts = program.opts();

const user = opts.user as string;
if (!isAddress(user, { strict: false })) {
  console.error(`invalid address: ${user}`);
  process.exit(1);
}

const client = createPublicClient({ chain: mainnet, transport: http(opts.rpc) });
const asofBlock = opts.asof === "latest" ? await client.getBlockNumber() : BigInt(opts.asof);
const result = await computeCoverScore(client, loadRegistry(), user as Address, asofBlock, {
  fromBlock: BigInt(opts.fromBlock as string),
  chunkBlocks: BigInt(opts.chunkBlocks as string),
});

const stringify = (v: unknown) =>
  JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x), 2);

if (opts.sign === false || !opts.signKey) {
  console.log(stringify(result));
  process.exit(0);
}

const signKey = opts.signKey as string;
if (!isHex(signKey) || signKey.length !== 66) {
  console.error("--sign-key must be 0x-prefixed 32-byte hex");
  process.exit(1);
}

console.log(stringify(await signCoverScore(result, signKey as Hex)));
