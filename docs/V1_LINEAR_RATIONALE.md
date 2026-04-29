# v1 Linear Cover Score: Methodology Rationale

The v1 Cover Score is linear-additive: weights `ωᵢ` accrue independently per holder, and the value function `v(S)` on a coalition is the sum of member weights. Under that linearity, the Shapley value collapses to a closed form numerically identical to pro-rata of time-integrated weighted balance:

```
φᵢ = ωᵢ × pool_reserve / Σⱼ ωⱼ
```

A reader could reasonably ask: *"If v1 numerically equals pro-rata of weighted balance, why ship Shapley as the methodology rather than pro-rata?"* This document answers.

## The collapse is a property of the linear case

For linear-additive `v`, the Shapley counterfactual `v(S ∪ {i}) − v(S)` reduces to `ωᵢ` regardless of `S`. The all-orderings averaging produces `ωᵢ`. The closed-form allocation `φᵢ = ωᵢ × pool_reserve / Σⱼ ωⱼ` is mathematically identical to pro-rata of time-integrated, token-weighted balance.

The collapse is not a deficiency. Shapley is *the unique* allocation function satisfying the four axioms (efficiency, symmetry, null-player, additivity); in linear cases, simpler rules also happen to satisfy the axioms and produce the same numbers. The methodology is what carries weight beyond v1.

## Why Shapley methodology, not just the v1 closed form

Five reasons the architectural choice is load-bearing:

### 1. Non-linear `v` is on the path

The cover-score substrate naturally extends to non-linear value functions:

- **Correlated risk**: when holdings in different qualifying tokens (raw USD8 + staked USD8 + LP positions) are correlated, the marginal contribution `v(S ∪ {i}) − v(S)` depends on what other tokens *i* holds. Pro-rata of weighted balance ignores correlation; Shapley captures it.
- **Multi-period games**: when prior-period contributions affect current-period cover need, the marginal is path-dependent. Pro-rata is path-independent and cannot encode this.
- **Multi-token synergy**: when certain combinations of tokens generate super-additive value (e.g., LP positions paired with staked yield), pro-rata of additive weights misses the synergy.
- **Cross-protocol exposure**: when holders in correlated external protocols affect USD8's effective cover requirement, the extended substrate's value function is non-linear in member identities.

In each case, Shapley produces materially different allocations than pro-rata. Per-share divergence in realistic non-linear scenarios is in the 5–20% range, sometimes higher for concentrated positions.

### 2. Per-period divergence compounds

A 10% per-period misallocation does not stay at 10% over a protocol's lifetime. It integrates. Holders who are persistently mis-allocated drift further from a fair share each period.

The iterated-Shapley primitive has a bounded-drift fixed point (Brouwer) — even under non-linear `v`, repeated allocation converges. Pro-rata under non-linear `v` has no such guarantee; drift is unbounded. The long-run economic cost of choosing pro-rata-now-and-rewriting-later is not the per-period error — it is the integral of error between rewrite trigger and convergence to the right substrate.

### 3. Each non-linear extension ships as a parameterization, not a rebuild

This is the strategic unlock of shipping Shapley v1 even with the linear collapse. The score function signature stays stable; non-linearity ships as a parameter on the existing substrate:

- Correlated LST risk → value-function parameter (correlation matrix between qualifying tokens)
- Multi-token synergy → coalition-coupling parameter (super-additive bonuses for token combinations)
- Multi-period games → temporal-extension parameter (history-dependent `v`)
- Cross-protocol exposure → extended-substrate parameter (external position observability)

None of these require:

- Rewriting the score function signature (integrators do not break)
- Re-doing the audit baseline (cumulative audit work amortizes; new audits focus on the marginal change)
- Rebuilding dispute / forfeiture layers (`docs/COUNTERFACTUALS.md`'s counterfactual primitive holds across all `v`)
- Migrating holder histories (Shapley extends naturally; pro-rata would discontinue at the linear/non-linear boundary)

A pro-rata substrate would force a full redeployment + re-audit + integrator migration on every non-linear addition. Shapley-from-v1 means each extension ships at the pace business and security warrant — module-by-module, not protocol-by-protocol.

### 4. The dispute and forfeiture primitives depend on Shapley framing

`docs/COUNTERFACTUALS.md` documents two applications of the counterfactual primitive `v(S ∪ {i}) − v(S)`:

- **Dispute counterfactuals** (verification, query-time)
- **Forfeiture counterfactuals** (correction, event-time — claim-layer score reduction; *not* fund-layer clawback, which is a distinct primitive outside this spec)

Both rely on the counterfactual being the building block of the score. Pro-rata has no natural counterfactual layer; its score is computed from total weighted balance, not from marginal contributions. Building dispute and forfeiture mechanisms on a pro-rata base is possible but not clean — the math does not flow from the same primitive.

Shipping Shapley in v1 means dispute and forfeiture ride on the same mathematical substrate as the score itself.

### 5. Anti-extraction encoded as axiomatic, not discretionary

The four axioms encode anti-extraction:

- **Efficiency**: the pool's value is fully distributed; no extraction surface in the allocation step
- **Symmetry**: equal contributors get equal shares; no insider-favoring discretion
- **Null-player**: zero contribution → zero share; no free-rider extraction
- **Additivity**: combined-game allocation = sum of sub-game allocations; no extraction through coalition restructuring

Pro-rata happens to satisfy these axioms in linear cases, but the satisfaction is incidental — pro-rata is not derived from the axioms. If governance ever proposes deviating from pro-rata (tier adjustments, cohort favoritism), there is no deeper principle to invoke. Under Shapley, the four axioms are the principle; governance is bounded by the math, not by precedent.

## What ships in v1

- The Shapley closed form for linear-additive `v`: `φᵢ = ωᵢ × pool_reserve / Σⱼ ωⱼ`
- Numerically identical to pro-rata of time-integrated weighted balance
- Architecturally identical to the substrate that handles non-linear extensions in v2+
- Compatible with the counterfactual primitive that underlies dispute and forfeiture (`docs/COUNTERFACTUALS.md`)
- Anti-extraction encoded as axiomatic at the score layer
- Forward-compatible with each non-linear extension as a parameterization of the existing function

The numerical simplicity of v1 is the easy case. The methodology has to hold in the hard cases, and Shapley is the only allocation function under the four axioms that does.

## References

- Shapley, L. S. (1953). *A Value for n-Person Games*. Contributions to the Theory of Games, II. Princeton University Press.
- See [`SHAPLEY.md`](SHAPLEY.md) for the foundational axioms.
- See [`COUNTERFACTUALS.md`](COUNTERFACTUALS.md) for the dispute and forfeiture applications.
