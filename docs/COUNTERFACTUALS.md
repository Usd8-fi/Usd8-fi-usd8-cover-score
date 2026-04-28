# Shapley Counterfactuals

The basic dispute path: "this score is wrong" + bond. Functional but coarse.

A Shapley counterfactual lets the challenger be specific:

> If you remove holder X's contribution, the proportional share for holder Y changes by Δ. The signed payload's allocation for Y is inconsistent with that counterfactual.

Same math as the score, just inverted — compute the marginal contribution of one player rather than the full allocation:

```
counterfactual_i(S) = v(S ∪ {i}) − v(S)
```

For the v1 linear-additive cover score this collapses to `ωᵢ` (the holder's own weight). Mathematically equivalent to the proportional-share check; the *form* of the dispute is what differs.

## What it adds

- Specifies *which* allocation is wrong, not just *that* something is
- Forces challengers to compute — you can't submit a counterfactual you didn't verify
- Discourages frivolous challenges
- Enables partial resolution: one bad allocation doesn't invalidate the whole signed payload

## Why now

For future non-linear extensions (correlated LST risk, multi-period games, cross-protocol attribution à la DeepFunding) the counterfactual primitive becomes mathematically necessary. Building it into the dispute layer now means those extensions plug in without rewriting dispute logic.

## Where it lives in the governance hierarchy

- **Physics**: the counterfactual math — immutable
- **Constitution**: USD8 supports counterfactual-based dispute as a verification path
- **Governance**: parameters (bond size, dispute window) — same governance-bomb treatment as basic dispute parameters; no new bomb categories

## References

Shapley (1953); see [`SHAPLEY.md`](SHAPLEY.md) for the foundational axioms.
