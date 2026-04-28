# Shapley Value Foundation

The Cover Score is a Shapley value of a cooperative game. This document explains the mathematical lineage, the axioms it satisfies, and why this is the unique fair allocation for a cover-pool setting.

---

## The cooperative game

For a cover pool with `n` USD8 holders:

- **Players**: holders {1, 2, …, n}
- **Coalitions**: any subset `S ⊆ {1, …, n}`
- **Value function `v(S)`**: the total value the coalition would be entitled to claim

Each holder `i` has a marginal contribution to every coalition that contains them. The Shapley value `φᵢ(v)` averages those marginal contributions across all possible coalition orderings.

---

## Shapley's theorem (1953)

Lloyd Shapley proved that for any cooperative game, **exactly one allocation** satisfies all four of the following axioms simultaneously:

1. **Efficiency** — the total payout equals the total value:
   ```
   Σᵢ φᵢ(v) = v(N)
   ```

2. **Symmetry** — players who contribute identically receive identical allocations:
   ```
   if v(S ∪ {i}) = v(S ∪ {j}) for all S not containing i or j,
   then φᵢ = φⱼ
   ```

3. **Null-player** — a player who contributes zero marginal value to every coalition receives zero:
   ```
   if v(S ∪ {i}) = v(S) for all S,
   then φᵢ = 0
   ```

4. **Additivity** — the Shapley value of a sum of games equals the sum of Shapley values:
   ```
   φᵢ(v + w) = φᵢ(v) + φᵢ(w)
   ```

This is a uniqueness theorem. Any allocation rule that fails one of these axioms is not Shapley. Any rule that satisfies all four is Shapley.

> Shapley, L. S. (1953). *A Value for n-person Games*. Contributions to the Theory of Games, vol. II, Princeton University Press.

---

## The linear-additive collapse

For a game where each player's contribution is independent — i.e., `v(S) = Σ_{i ∈ S} ωᵢ` for some per-player weight `ωᵢ` — the general Shapley formula reduces to:

```
φᵢ = ωᵢ · v(N) / Σⱼ ωⱼ
```

This is the form Cover Score uses. Each holder's `ωᵢ` is computed as the weighted balance-over-time integral across qualifying tokens, and `v(N)` is the cover-pool reserve at claim time.

The collapse preserves all four axioms:

- **Efficiency**: `Σᵢ φᵢ = v(N)` by direct algebra
- **Symmetry**: equal weights produce equal allocations
- **Null-player**: zero weight produces zero allocation
- **Additivity**: integrals are additive over time intervals — `score([0, T₁]) + score([T₁, T₂]) = score([0, T₂])`

---

## Pairwise proportionality

A useful additional property emerges automatically in the linear-additive case:

```
φᵢ / φⱼ = ωᵢ / ωⱼ   for any pair (i, j)
```

This is a structural fact, not an additional axiom. It is worth naming because it can be verified on-chain as a separate invariant: a verifier contract can check that any two payouts maintain the correct ratio without recomputing the full Shapley.

The same property anchors the audit story: any holder, given another holder's weight and payout, can independently confirm their own payout is proportional. Trust collapses to verifiable arithmetic.

---

## Application to Cover Score

Per holder `h`, the weight is:

```
ωᵢ(h) = Σ_token weight_token × ∫₀ᵀ balance_token(h, t) dt
```

Where:

- `weight_token` is admin-configurable (raw USD8 highest, staked lower, LP positions lower still — open-ended for future kinds)
- `balance_token(h, t)` is the holder's onchain balance for that token at time `t`
- `∫₀ᵀ … dt` is the time-weighted integral over the holding window — linear time, no log discount; every day at risk earns the same weight per unit balance

The score is:

```
φᵢ = ωᵢ · v(N) / Σⱼ ωⱼ
```

Where `v(N)` is the cover-pool reserve at claim time and the sum is over all holders' weights.

---

## Why Shapley specifically

A cover pool is a cooperative game by construction: multiple holders contribute to mutual coverage; the total claim capacity is finite; the question "what share is fair?" is a value-attribution question.

Common alternatives each violate at least one axiom:

| Alternative | Violation |
|---|---|
| Pro-rata of current balance | Violates symmetry under dynamic deposit timing — late entrants and early entrants with the same current balance are not equivalent contributors. |
| Time-weighted (linear) | Violates additivity if the weighting is anchored to deposit time rather than at-risk time. |
| Tier-based ("gold/silver/bronze" eligibility) | Violates null-player at tier boundaries: a holder just below a threshold receives zero, a holder just above receives a meaningful amount. |
| Discretionary committee allocation | Violates symmetry by definition; allocation depends on judgment, not contribution. |

Shapley is the only allocation that survives all four axioms simultaneously. It is not a preference — it is a theorem.

---

## Implementation correspondence

Each axiom is structurally enforced by the implementation:

- **Efficiency** — implementation: `Σᵢ φᵢ = v(N)` by construction since `φᵢ = ωᵢ · v(N) / Σⱼ ωⱼ`
- **Symmetry** — implementation: `getAddress` checksumming + identical timeline-construction code path for every holder
- **Null-player** — implementation: zero balance through the holding window produces zero `ωᵢ` and therefore zero `φᵢ`. Tests in `tests/integrate.test.ts` and `tests/balance-timeline.test.ts` verify this.
- **Additivity** — implementation: `integrateRaw` is a pure summation over segments
- **Pairwise proportionality** — verifiable on-chain via the same primitive used in VibeSwap's `PairwiseFairness.sol`

---

## Reference: augmented mechanism design

The framework that informed the Cover Score's specific form — separating bootstrapping (admin-tuneable) parameters from constitutional (Shapley-protected) invariants — is part of a broader cooperative-game / mechanism-design body of work. The portable primitive list and design rationale across that body of work informs the choices made here, but every axiom and theorem cited above stands independently on Shapley (1953).
