# Shapley Counterfactuals

The Shapley value `φᵢ` is built from counterfactuals. The unit is:

```
counterfactual_i(S) = v(S ∪ {i}) − v(S)
```

— the marginal contribution of holder *i* to a coalition *S*. The full allocation `φᵢ` is just the average of these counterfactuals across all orderings.

For the v1 linear-additive Cover Score, the counterfactual collapses to `ωᵢ` (the holder's own weight). Both applications below operate on this primitive — disputes verify it, forfeitures recompute it. For non-linear extensions (correlated LST risk, multi-period games, cross-protocol attribution à la Deep Funding) the combinatorial structure of `v(S ∪ {i}) − v(S)` becomes load-bearing.

The primitive admits two complementary applications in USD8.

## 1. Dispute counterfactuals (verification, query-time)

Basic dispute path: "this score is wrong" + bond. Functional but coarse.

A counterfactual dispute lets the challenger be specific:

> If you remove holder X's contribution, the proportional share for holder Y changes by Δ. The signed payload's allocation for Y is inconsistent with that counterfactual.

What it adds over basic dispute:

- Specifies *which* allocation is wrong, not just *that* something is
- Forces challengers to compute — you can't submit a counterfactual you didn't verify
- Discourages frivolous challenges
- Enables partial resolution: one bad allocation doesn't invalidate the whole signed payload

## 2. Forfeiture counterfactuals (correction, event-time)

A defined onchain event (extraction detected, sybil flag, registry change) triggers a counterfactual recomputation: *recompute holder i's weight as if their balance during the trigger window had not accrued.*

```
forfeiture_i(window) = ωᵢ(full history) − ωᵢ(history minus trigger window)
```

The post-forfeiture score is `φᵢ` computed from the corrected weight. Where dispute is *holder-initiated and verifies the score*, forfeiture is *event-initiated and corrects the score*.

What it enables:

- Anti-gaming with teeth: detected misbehavior maps deterministically to score reduction
- Score reductions are themselves auditable (same counterfactual math, different inputs)
- The trigger-window's accrual is structurally disqualified, not punitively penalized

## Terminology note

**Forfeiture, not clawback.** This primitive operates at the *claim* layer — the holder's score is reduced *before* it converts to payout. No previously-distributed funds are recalled. The holder forfeits accumulated weight from the trigger window; their share of the cover pool shrinks accordingly.

A true clawback (recovery of already-distributed funds) is a distinct primitive that would require additional mechanism — escrow holdback, redemption hooks, or contract-level recovery authority — and is not part of this spec. If a holder receives yield distributions during a window that later triggers, only the future-claim portion is affected by this counterfactual; any already-distributed amount is outside this primitive's scope.

The accounting register is closer to *forfeiture of accrued benefit for cause* (pension/employment law) or *score restatement* (financial restatement after misreporting) than to clawback (recovery of paid funds). Naming the layer correctly matters for audit-grade scrutiny and for keeping the spec's mechanism boundaries clean.

## Composition

The two applications operate at orthogonal layers — query-time vs event-time — and compose:

- **Forfeiture is itself disputable.** If a trigger fires incorrectly, the affected holder can submit a dispute counterfactual against the post-forfeiture score showing the correction is wrong. Same primitive, applied to the recomputed allocation.
- **Dispute can target either pre-forfeiture or post-forfeiture scores.** The verifier checks against whichever score the server signed.

The corrective layer doesn't get to bypass verification.

## Determinism scope

The score at time T is a deterministic function of *all chain state observable at T* — balance histories AND triggering events.

Verifiers reproducing a holder's score must replay both:

- Balance history (per qualifying token)
- Trigger event log (extraction flags, sybil decisions, registry changes)

Without the trigger log, a verifier can reproduce the *pre-forfeiture* score but not the *signed* score in cases where forfeiture applied.

## Where it lives in the governance hierarchy

- **Physics**: the counterfactual math — immutable
- **Constitution**: USD8 supports counterfactual disputes (verification) and counterfactual forfeitures (correction) as the two paths through the dispute layer
- **Governance**: parameters (bond size, dispute window, trigger predicates, forfeiture-window scope) — same governance-bomb treatment as the basic dispute parameters; no new bomb categories

## References

Shapley (1953); see [`SHAPLEY.md`](SHAPLEY.md) for the foundational axioms.
