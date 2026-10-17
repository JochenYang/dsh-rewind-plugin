# Spec — a recall must say where history ends, and let other plugins clean up

**Status:** to implement. This document is the change list and the acceptance criteria for one
release of this package. A verified implementation of everything below already exists on this
machine — port it rather than re-deriving it (see §7). Same arrangement as
`docs/rewind-workspace-snapshot.md`.

**Why now:** two gaps, both measured on the sister implementation (`plugin-rewind` 0.1.5 in
`D:\codes\DSH-APP\dsh-app`, which was itself ported from this package's line):

1. **A recall after a compaction silently offers fewer points.** `listAnchors` walks
   `session.surface.nodes`, so prompts older than the kernel's compaction replacement are already
   absent — but nothing *says* that. A user who remembers twenty messages sees eight rows and cannot
   tell "the conversation was compacted" from "the plugin lost my history". The reference
   implementation solved this by naming the stop; this package still cannot.
2. **A recall restores files but nothing else.** Any other plugin holding state derived from the
   conversation (a plan board, a memory index, a worktree) has no way to learn that a recall
   happened, so it keeps state pointing at turns that are no longer on the surface. The reference
   implementation publishes a participant registry and turns its own file revert into the first
   participant, which is what proves the seam is usable rather than theoretical.

Both are additions, not rewrites: the recall's storage model (`surfaceOp` replacement) is unchanged,
and the anchor enumeration is unchanged.

## 1. The compaction boundary

**Mechanism.** DSH marks a compaction by appending one `user/message` whose `source.kind` is
`compact-checkpoint` (`@deepseek-ai/dsh-compaction`). The surface replacement that follows rewrites
the prefix, so every node before the newest checkpoint is gone from `surface.nodes` — which is
exactly why `listAnchors` already stops there, and why the boundary is computable without touching
the enumeration:

```ts
/** The seq of the newest `compact-checkpoint` node on the surface, or null. */
export function compactionBoundary(session: SessionLike): number | null {
  const nodes = session.surface.nodes
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const event = session.eventAt(nodes[i])
    if (event === undefined) continue
    if (event.type !== 'user/message') continue
    if (isCompactCheckpointSource(event.data)) return nodes[i]
  }
  return null
}
```

**Say it in the answer.** Add one stable code beside `rewind.host.outOfRange`:

```ts
| 'rewind.host.compactionBoundary'   // params: { available, requested }
```

It is a **separate** code, not a variant of `outOfRange`: "there is no number 3" and "nothing before
the compaction is recallable" lead a user to different next steps, and collapsing them sends everyone
to the wrong place. The client sentence names both numbers and the reason.

**Say it in the picker.** The plan payload gains one optional field, and the projection exposes the
same boolean, so the client can render a single line above the list:

```ts
readonly stoppedAtCompaction?: boolean
```

The dialog's wording matters: the list the user is choosing from never held those messages, which is
different from "your messages are gone". Keep the sentence factual about the boundary.

**One computation for both surfaces.** Add one function and call it from both the bare `/rewind` and
`/rewind <n>`, so the count the picker offers and the count the command resolves can never disagree:

```ts
export function availability(
  session: SessionLike,
  max: number = MAX_ANCHORS,
): { readonly maxTurns: number, readonly stoppedAtCompaction: boolean } {
  return { maxTurns: listAnchors(session, max).length, stoppedAtCompaction: compactionBoundary(session) !== null }
}
```

Note the two different caps: the client always lists `MAX_ANCHORS`, while the host resolves against
`config.maxAnchors`. Pass the host's cap from the command; the picker's list can be longer, and a
smaller host cap truncating it is the existing behaviour, unchanged.

**One assumption to write down (and re-check).** Every surface operation on this line replaces a
PREFIX (compaction) or one node in place (the tool-result pruner, the loop's runtime context). Given
that, the newest checkpoint is always where recallable history ends — a later compaction consumes the
older checkpoint with the prefix it rewrites. The kernel also exports `compactSurfaceRegion` for a
MIDDLE span, which this assumption does not cover: if a producer ever compacts a middle span, prompts
older than the checkpoint stay recallable and `stoppedAtCompaction` becomes a lie. The reference
implementation carries this note in `compactionBoundary`'s header; keep it.

## 2. The participant registry

**The seam.** Publish one service from the host half, named after the package (`dsh-rewind-participants`
here; the sister implementation uses `dsh-app-rewind-participants` because its scope is `@dsh-app`).
Consumers declare it in their own `inject`; a plugin that does not is unaffected. Registration is the
usual cordis shape: returns a disposer, duplicate ids throw rather than silently replacing (two
consumers sharing an id would make the recall's report name one of them and lose the other's).

```ts
export interface RewindRecallContext {
  readonly sessionId: string
  readonly plan: PlannedCut
  /** Read-only by contract: at run time it is the live Session. */
  readonly session: SessionLike
}

export interface RewindParticipant {
  readonly id: string
  reconcileAfterRewind(context: RewindRecallContext): Promise<unknown> | unknown
}

export interface RewindParticipantRegistry {
  register(participant: RewindParticipant): () => void
  list(): readonly RewindParticipant[]
  reconcileAll(context: RewindRecallContext): Promise<Map<string, unknown>>
}
```

**What `reconcileAll` guarantees.**

- **It never rejects.** A participant that throws or rejects is contained: the message becomes a
  warning in the plugin log, the next participant still runs, and the recall's own report simply has
  no entry for that id. The write already landed; one consumer's failure is its own.
- **Order is registration order**, and membership is snapshotted per pass — a participant that
  unregisters itself (or another) during a reconcile cannot shift the list under the loop and skip
  someone. One registered *during* a pass runs from the next recall, which is the only order that
  keeps a pass's membership fixed.
- **Each participant has a deadline** (30 s in the reference implementation, injected for tests). The
  command awaits this loop before it forgets the recorder's before-images and drops the range's
  snapshots, so a participant that never settles would otherwise freeze the command and leak both. A
  deadline turns that into the failure the seam already handles: a warning, the id missing from the
  report. Use `Promise.race`, not an abort signal — the contract takes no signal, and cancelling a
  restore mid-way is worse than reporting it late.

**Run it after the write.** The surface write is the recall's authoritative act; participants are
after-the-fact reconciliation. In the command:

```
availability() → plan → append(surfaceOp) → participants.reconcileAll() → drop the range's
before-images and snapshots → report
```

**Its own file revert is the first participant.** Register `revertFiles`'s existing entry point as
one participant and read its report back out of the returned map, so the recall's `restored` /
`removed` / `coverage` fields keep coming from the same place. This is what proves the seam works —
do not add a second participant inside this package just to have two.

## 3. What the report looks like

The recall's answer keeps its current fields. The only additions are the new reason code, the
`stoppedAtCompaction` flag on the plan payload, and (host-side only) the participants' report map,
which the command reads from and does not forward.

## 4. Acceptance criteria

Add tests with the change; the reference implementation's suites are listed in §7 as a cross-check.

| # | Case | Expectation |
|---|---|---|
| 1 | Surface `prompt A → checkpoint → prompt B` | `listAnchors` holds B only; `availability().stoppedAtCompaction === true` |
| 2 | Same surface, ask for a point beyond the list | answer carries `rewind.host.compactionBoundary`, not `outOfRange` |
| 3 | Surface with no checkpoint | `stoppedAtCompaction === false`; asking beyond the list still answers `outOfRange` |
| 4 | Projection vs `listAnchors` | still byte-for-byte equivalent (the existing cross-check extends to the flag) |
| 5 | Register two participants, run a recall | both receive one call, in registration order; the report carries their ids |
| 6 | Duplicate id | `register` throws; the first stays registered |
| 7 | Dispose one, run again | the disposed one is not called |
| 8 | A participant that throws / rejects | the recall still succeeds, the next participant runs, the id is absent from the report |
| 9 | A participant that never settles | the pass completes at the deadline; the id is absent from the report |
| 10 | A participant unregistering during a pass | the remaining members still run (membership snapshot) |

## 5. Public API and release

Per `AGENTS.md` §Public API, this is a **MINOR** change (`0.(y+1).0`): one new code in
`RewindCode`, one new optional field on the plan payload, one new provided service name, and one new
boolean in the `rewindAnchors` projection value. Add all four to that list when you change them.
`CHANGELOG.md` gets one entry under Added (and the participant seam under Changed: the file revert
moves from an inline call to a participant, with identical reported fields).

## 6. Deliberately not ported

- The reference implementation's branch-switch / state-replay storage model — `surfaceOp`
  replacement is its DSH equivalent, and mixing them would break the append-only log.
- Its dependency-injection framework and its error base classes; cordis `provide` / `inject` and the
  existing coded answers are the local equivalents.
- Cross-compaction context rebuilding. The boundary is a **stop**, not a resume.
- Adding recall semantics to other plugins. This release publishes the seam; it does not implement
  anyone's reconciliation.

## 7. Reference implementation

`D:\codes\DSH-APP\dsh-app\plugins\plugin-rewind` at **0.1.5**, verified by 177 tests and shipped in
`v0.16.6` (runtime `suiteVersion 47afe292`). Read the module headers before copying anything — they
state the constraints the code cannot.

| what | where (as of 0.1.5) |
|---|---|
| `compactionBoundary`, `availability` | `src/cut.ts` — `compactionBoundary` and `availability` |
| the code and its params | `src/wire.ts` — `RewindCode` (`rewind.host.compactionBoundary`), `stoppedAtCompaction` on the plan payload |
| the client sentence | `src/client/locales.ts` — `rewind.host.compactionBoundary` in both dictionaries |
| projection flag | `src/projection.ts` — the wire shape and `state.nodes.some(node => node.checkpoint)` |
| the registry | `src/participants.ts` — the whole module, including the deadline and the membership snapshot |
| wiring | `src/index.ts` — `ctx.provide('dsh-app-rewind-participants', …)`, the `revertFiles` participant, the command's one `availability()` call, `reconcileAll` after the write |
| tests | `tests/anchors.test.ts` (boundary + availability), `tests/cut.test.ts`, `tests/projection.test.ts`, `tests/participants.test.ts`, `tests/popup.test.ts`, `tests/locales.test.ts` |
| design record (Chinese) | `docs/plans/rewind-undo-parity.md` — the work items, the rationale for each decision, and the out-of-scope list |

Port order that keeps the tree green at every step: boundary + availability first (one reason code,
one payload field, one projection flag, tests 1–4), then the registry with the file revert as its
first participant (tests 5–10). The two halves are independent; landing them as two commits makes a
bad port easy to bisect.
