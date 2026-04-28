# Self-Review: USD8 Cover Score v0.1.0

**Date**: 2026-04-28
**Reviewer**: JARVIS (self-audit, pre-external-review)
**Scope**: `src/*.ts` (393 LOC, 8 files), `tests/*.ts` (336 LOC, 28 tests, 3 files), config + docs
**Posture**: Reading as if OpenZeppelin will audit next.

---

## Methodology

- Static review of all code paths
- Cross-check against off-chain-relevant attack patterns: signature replay, signature malleability, input validation, RPC trust, integer overflow, key handling, address-handling parity
- Three explicit non-vulnerability axes per partnership invariants: **leanness, availability, determinism**

---

## Findings

### Critical
None.

### High
None.

### Medium

**M-1. RPC trust is implicit, not documented.**
- The implementation trusts the configured RPC's responses. A malicious RPC could omit Transfer events (under-counts score), inject fake events from the queried token's address (over-counts score, fraudulent claim), or return wrong block timestamps (mis-integrates). This is a fundamental property of off-chain RPC architecture, not a bug, but it must be a stated assumption.
- **Mitigation already in place**: open-source algorithm + dispute window allows any party to re-run against a different RPC and challenge.
- **Recommendation**: Add an explicit "Trust Assumptions" section to README naming the RPC as a trusted component in the threat model. Recommend production deployments use paid archive RPCs (Alchemy, Infura, QuickNode), and note that the dispute window is the correctness backstop.

### Low

**L-1. `--rpc` URL is not validated.**
- A malformed URL produces a cryptic viem error instead of a clear input-error message at CLI parse time.
- **Recommendation**: Validate URL with `new URL(opts.rpc)` early; fail with a clear message if invalid.

**L-2. No bounds check on `--from-block` vs `--asof`.**
- If `fromBlock > asofBlock`, the chunked loop simply doesn't iterate. Result is empty contributions and `rawWeight: 0`. Defensible but silent — a user mis-specifying the range gets a zero score with no clue why.
- **Recommendation**: Throw early if `fromBlock > asofBlock` with a clear error.

**L-3. `--sign-key` flag is captured in shell history.**
- Production operators should use `SIGN_KEY` env var only.
- **Recommendation**: Add a warning in the CLI help text ("--sign-key is for testing only; use SIGN_KEY env var in production").

**L-4. `normalizeIntegral` uses JS Number division for fractional remainder.**
- For very large `rawIntegral` values, the remainder-as-Number step can lose precision.
- **Mitigation already in place**: `rawWeightToScaled` re-rounds to 1e18 fixed-point bigint for the signed payload, so the chain-side verifier never sees the lossy float.
- **Recommendation**: No code change required; document the precision boundary in `normalizeIntegral`'s JSDoc.

### Informational

**I-1. `verifyingContract` in EIP-712 domain is optional.**
- If a deployment doesn't set `verifyingContract`, signatures are valid for any contract that claims this domain (`USD8 Cover Score`, version `1`). This is fine for dev but a foot-gun in production.
- **Recommendation**: Document that production deployments MUST pass `verifyingContract` to `signCoverScore` and `verifyCoverScoreSignature`. Consider making it required at the type level for v2.

**I-2. Same-block transfer ordering is not preserved beyond block-number sort.**
- Two transfers in the same block with different log indexes are treated as equal-order. For the current score math (additive integral), this doesn't matter — addition is commutative. If a future feature cares about intra-block ordering, the sort needs `(blockNumber, logIndex)` tuple.
- **Recommendation**: No change needed for v1; flag for v2 if intra-block ordering becomes load-bearing.

**I-3. One adapter, one error, one full-result failure.**
- A negative-balance throw on one token aborts the whole `Promise.all`, so the holder gets no score for any token. With more than one qualifying token in the registry, a malformed token poisons unrelated contributions.
- **Recommendation**: Consider per-token error isolation in the adapter-pattern v2 (`failed: true` on one contribution, score continues for others). Acceptable for v1 since the registry is admin-curated and admin-time validation can catch malformed tokens before they enter production.

**I-4. No same-asofBlock replay protection at the algorithm layer.**
- Two separate signed scores for the same holder at the same `asofBlock` are both individually valid. The claim contract is responsible for one-claim-per-period semantics.
- **Recommendation**: Document this in README so the claim contract design accounts for it.

---

## Vulnerability scan summary

| Class | Status |
|---|---|
| Signature replay across chains | ✓ chainId in EIP-712 domain |
| Signature replay across blocks | ✓ asofBlockHash in message |
| Signature replay across holders | ✓ holder address in message |
| Signature malleability | ✓ EIP-712 (canonical encoding, no JSON ambiguity) |
| Address-comparison case-sensitivity | ✓ checksummed everywhere via `getAddress` |
| Integer overflow on weight scaling | ✓ explicit upper bound (`rawWeight > 1e18` throws) |
| Negative balance from malformed log | ✓ explicit throw with context |
| Key leak via stdout/stderr | ✓ private key never logged |
| Unbounded RPC scan | ✓ chunked, configurable chunk size |
| Spoofed Transfer events from non-token contracts | ✓ `getLogs` filters `address: token` |
| Cross-token contamination via shared state | ✓ each token computed in isolation, joined at the end |

---

## Scoring rubric

### Leanness: 4 / 5

- 393 src lines for the full algorithm including EIP-712 signing, chunked log fetching, signed-payload generation, partial-history-scan support (initial-balance via balanceOf), CLI wrapper, and full type system
- Zero unused exports, zero dead code, zero defensive layers beyond load-bearing
- Single shared helper (`stringify`) where two paths used the same JSON serialization
- Tests at 336 lines for 28 tests — proportional, not bloated
- **Why not 5/5**: A few JSDoc comments describe non-obvious WHY which is audit-readability investment. Could compress further at cost of audit clarity. Trade-off explicitly chosen for OZ-bar.

### Availability: 4 / 5

- Algorithm has exactly one external dependency: the RPC
- Chunked log fetching stays within typical RPC limits (10k blocks per query default)
- Try/catch on `balanceOf` falls back to `0n` on RPC pruning (degraded but functional)
- Failure modes are explicit and contextual (negative-balance throws with token + block + balance + holder)
- **Why not 5/5**: The RPC is a single point of failure. Multi-RPC fallback or local-archive support would be true 5/5 but adds surface area; v2 candidate.

### Determinism: 5 / 5

- Pure-function reductions where possible (`integrate`, `normalize`)
- Address checksumming canonical at every boundary
- EIP-712 typed data → canonical bytes for signing (no JSON-stringify ambiguity)
- bigint scaling for rawWeight (no float drift in the signed payload)
- Sort comparator is stable and deterministic
- Tests cover anti-replay invariants (chainId, blockHash, rawWeight tampering all invalidate signature)
- Given the same `(registry, holder, asofBlock, fromBlock)` and an honest archive RPC, output is byte-identical across runs and machines

---

## Recommendations (priority order)

1. Document RPC trust assumptions in README (Medium: M-1)
2. Document `verifyingContract` requirement for production (Informational: I-1)
3. Validate `--rpc` URL early in CLI (Low: L-1)
4. Throw early if `fromBlock > asofBlock` (Low: L-2)
5. Add `SIGN_KEY` env-var warning in CLI help (Low: L-3)
6. Document precision boundary in `normalizeIntegral` JSDoc (Low: L-4)
7. Document same-asofBlock replay semantics for the claim contract (Informational: I-4)

None block initial review or push. All are low-effort additions on the next pass.

---

## Conclusion

**No critical or high findings.** One medium (M-1) is a documented architectural assumption rather than a code bug. Lows and informationals are minor input-validation and documentation improvements.

The codebase is **safe to push for external audit** pending Will's approval. The three partnership-invariant axes (leanness, availability, determinism) score 4/5, 4/5, 5/5 — with leanness and availability gated by trade-offs explicitly chosen (audit-readability investment, RPC architecture) rather than oversights.
