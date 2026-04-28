# @usd8-fi/cover-score

**Cover Score algorithm for USD8. Open-source, deterministic, locally-verifiable.**

This is the algorithm USD8's claim server runs to compute a holder's Cover Score from their token-holding history. It is open-source so any holder, auditor, or challenger can run it locally against the same chain data and reproduce the same score, byte-for-byte.

If a USD8 holder's signed score from the server doesn't match what this algorithm produces locally, they can dispute it.

---

## What it computes

For a holder `h`, an asof block `T`, and a registry of qualifying tokens with admin-configured weights:

```
wᵢ(h) = Σ_token weight_token × ∫₀ᵀ balance_token(h, t) dt
```

The raw weight `wᵢ` is then converted to a proportional Cover Pool share:

```
φᵢ = wᵢ × v(N) / Σⱼ wⱼ
```

…where `v(N)` is the Cover Pool reserve at claim time and `Σⱼ wⱼ` is the sum of all holders' weights. This is the linear-additive Shapley value collapse: efficient, symmetric, null-player-respecting, additive, and pairwise-proportional by construction.

---

## Install

Requires Node.js ≥ 20.

```bash
git clone https://github.com/Usd8-fi/usd8-cover-score
cd usd8-cover-score
npm install
```

---

## Verify your own score (5 minutes)

```bash
npx tsx src/cli.ts \
  --user 0xYourWalletAddress \
  --asof 18500000 \
  --from-block 18450000 \
  --rpc https://YOUR_RPC_URL \
  --no-sign
```

Output is a JSON document with:

- `contributions[]` — one entry per qualifying token, with the per-token segment timeline and weighted contribution
- `rawWeight` — your wᵢ (the input to the proportional Shapley share)
- `asofBlockHash` — the chain state your score was computed against (anti-replay anchor)

Compare `rawWeight` to the value in the signed score USD8's server gave you. If they don't match, you have a verifiable basis to dispute.

---

## CLI options

| Flag | Purpose |
|---|---|
| `--user <address>` | Holder wallet address |
| `--asof <block>` | Asof block (decimal or `latest`) |
| `--from-block <block>` | Start of history scan. In production = USD8 contract deployment block. In demos = recent block to limit RPC scope |
| `--chunk-blocks <n>` | Blocks per `getLogs` query (default 10000). Lower if your RPC caps log queries |
| `--rpc <url>` | RPC URL. Defaults to `RPC_URL` env var, then a public fallback |
| `--sign-key <hex>` | 32-byte ECDSA private key for signing (env `SIGN_KEY`) |
| `--no-sign` | Skip signing, output unsigned result |

---

## RPC requirements & trust

- **Archive access** for `--from-block` in the past (algorithm calls `balanceOf` at fromBlock for initial state)
- **Transfer event indexing** with `from`/`to` filterable as indexed parameters
- Paid RPCs (Alchemy, Infura, QuickNode) work out of the box; free public RPCs may prune history or rate-limit

**Trust model**: the RPC is a trusted component. A malicious RPC can omit, inject, or alter Transfer events and block timestamps to skew the score. The open-source algorithm + claim-contract dispute window are the correctness backstop — any party can re-run against a different RPC and challenge if results diverge. Production deployments should use a paid archive RPC; verifiers should pick their own independent RPC.

---

## Determinism

Given the same `(registry, holder, asofBlock, fromBlock)` and an honest archive RPC, this algorithm produces the same `rawWeight` byte-for-byte every time.

The signed payload uses **EIP-712 typed data** so the digest is canonical and can be verified by Solidity contracts via `ecrecover` against the score-server's public key.

Anti-replay is built into the signature domain:

- `chainId` — replays across chains rejected
- `asofBlockHash` — replays against different historical state rejected
- `holder` — replays against different addresses rejected

**Production deployments must set `verifyingContract`** when calling `signCoverScore` and `verifyCoverScoreSignature`. Without it, signatures are valid for any contract claiming this domain — fine for dev, foot-gun in production.

---

## Constitutional clauses

This repo's name and description encode invariants. Any fork claiming to be "Cover Score for USD8" must satisfy:

1. **Open-source** — full algorithm publicly readable and auditable
2. **Deterministic** — same inputs always produce the same output (no randomization, no time-dependent compute, no hidden state)
3. **Locally-verifiable** — any party can run it against the same chain data and reproduce the score

A fork that closes the source, introduces randomization, or requires a proprietary verifier is no longer "Cover Score for USD8." The four words in the description are the bright line.

---

## Project layout

```
src/
  types.ts            // Shared types
  registry.ts         // Qualifying-token registry (admin-configured weights)
  balance-timeline.ts // Transfer events → constant-balance segments per token
  integrate.ts        // Pure time-weighted reduction
  cover-score.ts      // Orchestrator: registry × timeline × weights → raw weight
  sign.ts             // EIP-712 typed-data signing + verification
  cli.ts              // Command-line entry point
  index.ts            // Library exports

tests/
  integrate.test.ts        // Pure function tests
  balance-timeline.test.ts // Segment construction tests
  sign.test.ts             // EIP-712 sign+verify roundtrip + tampering tests
```

---

## Tests

```bash
npm test
```

28 tests covering: time-integration math, segment construction (incl. self-transfers, full withdrawals, malformed-log guard), EIP-712 sign/verify roundtrip, anti-replay invalidation across chainId / blockHash / rawWeight tampering.

---

## License

MIT
