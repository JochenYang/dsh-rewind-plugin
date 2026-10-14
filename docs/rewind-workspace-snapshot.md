# Spec — a recall must put back what a shell command wrote

**Status:** to implement. This document is the change list and the acceptance criteria for one
release of this package. A verified implementation of everything below already exists on this
machine — port it rather than re-deriving it (see §7).

**Why now:** a user recalled a message, the plugin reported a clean success, and the files a shell
command had just rewritten were still there. The plugin's own docs promise the opposite ("the
confirmation dialog and the result say so; never let the plugin claim a clean revert" — `AGENTS.md`,
Traps), and the code cannot deliver it: it only ever sees the two write waterfalls, so it has no list
of what it missed. That gap is the subject of this spec.

## 1. The defects, with the evidence that established them

Measured on a real session, not theorised. Session `session-b181874c`, project `D:\codes\geluman-web`,
2026-10-13 14:54:07, one recall of the message "…`redesign/public/images/panda-sprites.png` 这里是精灵图
你可以需要用css控制帧动画".

| # | Defect | Evidence |
|---|---|---|
| D1 | A file written by a shell command (`pwsh`, `run_code`, a script the model ran, an office renderer) is neither restored NOR reported. The recall answers a clean success over a tree it only partly put back. | That recall's result: `{"restored":6,"removed":8,"unrestorable":[]}`. The same recalled range contains **27 shell calls** — 18 python runs of `sprite-build.py`/`sprite-probe.py`/`sprite-debug.py`/`sprite-bg.py`, 3 × `npm run build`, 3 × playwright — which rewrote `redesign/public/images/panda-sprites.png` (the file the recalled message was about), `panda-frames.png`, `grid-debug.png` and `redesign/dist/**`. The plugin's own count of the range's changes is 14 files, and all 14 came from `write`. |
| D2 | The recorder is keyed by turn number alone, so one session's recall can match another session's same-numbered turn and restore that session's before-image. | Reproduced end to end: two sessions in one process, both turn 2 writing the same path; a recall in session B put the file back to session A's before-image (`v0` instead of `a2`). |
| D3 | A range with no snapshot at all — a restarted kernel child, or a turn from before the feature existed — is reported exactly like "nothing changed": `{restored:0,removed:0,unrestorable:[]}`, no note anywhere. | Reproduced; and it is the same shape as D1's report. |
| D4 | Before-images are read and written as `utf8`, so "restoring" a binary file corrupts it. A PNG read as utf8 and written back is not the PNG that was there. | Code path; and D1's own case is a PNG. |
| D5 | Two writes to one path in one turn (the normal `edit` then `edit` shape) can pick the LATER before-image, because "the first" was decided by the order the async captures finished rather than by write order. | Code path; the thread pool does not guarantee completion order. |

## 2. What the release must do

1. **A second before-image source.** Take one bounded copy of the workspace at the START of a turn,
   before the first tool call of that turn that could write, and store it content-addressed under
   `$DSH_HOME/storages/dsh-rewind-plugin/{trees,blobs}`. A recall of turns `[t0..T]` then diffs the
   current workspace against turn `t0`'s copy, which is the state the range began in.
2. **Two sources, merged.** The write waterfall gives an exact before-image for `write` / `edit` /
   `str_replace_editor`, and is the only source that sees a write OUTSIDE the workspace or under a
   directory the workspace walk skips. Where the snapshot covered a path, the snapshot's bytes are
   authoritative (they are the range's starting state, and they are the only record of a shell
   command's write); everywhere else the recorder's before-image is used. A covered path the diff
   found unchanged is not restored at all — restoring identical bytes only adds a quarantine copy.
3. **Session-scoped recorder.** `record`, `changesForTurns`, `failuresForTurns` and `forget` take a
   session id; the recorder is created once per process, so a turn number alone is not an identity.
4. **Write-ordered before-images.** Store the write's log sequence on each recorded change and order
   `changesForTurns` by it, so "the first before-image of a path" means the first WRITE.
5. **Byte-exact content.** Before-images are `Buffer`, not text. Text is produced only where a diff
   needs a string, and a byte image with a NUL is not text.
6. **An honest coverage verdict.** `coverage: 'full' | 'partial' | 'none'` rides the command result
   and the confirmation preview, with `coverageReason` and the names of the writing tools involved.
   `none` means: a tool whose writes this plugin cannot observe ran in the range AND there is no
   snapshot for its first turn. That is the case that used to be reported as an unqualified success.
7. **A bounded store.** The walk is bounded by file count, total bytes, per-file bytes, a deadline and
   the tool call's abort signal; the store is trimmed by per-session turn count, manifest age and total
   blob bytes. Every bound that was hit is reported (as `partial` + a reason), never hidden.

## 3. Safety rules — not optional

These were each found by an adversarial review of the reference implementation AFTER it passed its own
tests. Getting one wrong damages a user's tree, which is the one outcome this feature must not have.

- **An incomplete walk never decides that a file was created.** A file the walk never reached is
  indistinguishable from one that did not exist, and "created" means "move it into the quarantine" —
  i.e. out of the user's workspace. Applies to the SNAPSHOT's walk and to the DIFF's own walk.
- **A file the walk SAW but could not copy is never "created" either.** Record it in a separate
  `uncaptured` table with the reason (`too-large` / `unreadable` / `symlink`) and the size+mtime it
  had; report a change to it as unrestorable. Dropping it from the manifest silently is how it becomes
  indistinguishable from absent.
- **A blob whose bytes do not hash to the name its manifest gives is reported, never written back.**
- **The quarantine copy comes first, always.** The current bytes are written into the quarantine slot
  before the before-image is written back; a created file's bytes are copied out before it is unlinked.
  Nothing is ever deleted without a copy existing. Never use `rename` for this — `$DSH_HOME` and the
  workspace can be on different volumes (`EXDEV`).
- **A missing before-image is a report, not a removal.** `before: null` means "the range created it"
  and nothing else; a blob that is gone or unreadable must not be turned into that.
- **A tool call is never failed by this plugin.** The `tools/pre-execute` listener must always forward
  `next()`, must swallow its own errors (log them), and must observe `exec.signal`.
- **The snapshot must be taken BEFORE the first writing tool of the turn.** `write` and `edit` DO
  trigger it: a turn that writes and then runs a shell command would otherwise be snapshotted after the
  write, and the diff would then treat that write as part of the range's starting state. Read-only
  tools do not trigger it. An unknown tool DOES (erring toward a walk is safe; erring toward silence
  loses a file).
- **No new `@deepseek-ai/*` peerDependency** — the installer refuses a version mismatch (see
  `AGENTS.md`, Traps, and `tests/port.test.ts`). Declare the two new events in the plugin's own
  `declare module '@deepseek-ai/cordis' { interface Events { … } }` block, the way the existing two
  waterfalls are declared.

## 4. Change points, in this repository's terms

| Path | Change |
|---|---|
| `src/trees.ts` | **NEW.** The workspace snapshot store. Port from the reference; only the storage root changes (`storages/dsh-rewind-plugin/{trees,blobs}`). |
| `src/snapshots.ts` | Before-images become `Buffer`; add `textOf` (text only when the bytes have no NUL); `restoreOne` gains an optional max-bytes and writes bytes. Keep the quarantine layout and the "no rename" rule. |
| `src/recorder.ts` | `record(sessionId, path, turn, seq)` becomes `async` and AWAITS the capture (a before-image read after the write landed is not a before-image); store `seq`; sort `changesForTurns` by it; all query/forget methods take the session id. |
| `src/index.ts` | `Config` gains `snapshotWorkspace` (default true), `maxSnapshotFiles`, `maxSnapshotBytes`. Register the `tools/pre-execute` gate (`{ prepend: true }`, awaited snapshot, errors swallowed, signal passed). Add `mergeTargets`, `coverageOf`, `snapshotDiff`; thread the merge through `previewRevert` and `revertFiles`; call `recorder.forget(sessionId, turns)` and `dropSnapshots(...)` after a recall; carry `coverage`/`coverageReason`/`tools` in the result. |
| `src/wire.ts` | Add `RevertCoverage` and the `coverage` / `coverageReason` / `tools` fields on `RevertPlan`. |
| `src/client.ts`, `src/client/messages.ts`, `src/client/confirm-dialog.tsx`, `src/client/locales.ts` | Render the coverage sentence after a recall and in the confirmation dialog; map the reason codes (`noSnapshot`, `file-count`, `total-bytes`, `timeout`, `unreadable-*`/`symlink`, other) to dictionary keys. Both dictionaries gain the keys — `zh` is the key union, so a missing key fails the build. |
| `tests/trees.test.ts` | **NEW.** Port from the reference. |
| `tests/revert.test.ts` | **NEW.** Port from the reference: it mounts the host half with a real `Session` + a real cordis `Context`, drives the real `tools/pre-execute` gate, and runs `/rewind` through its own handler. This is the test whose absence let D1 ship. |
| `tests/recorder.test.ts` | Update for the new signature and bytes; add the two-session isolation case and the write-order case. |
| `README.md`, `README.zh-CN.md` | Correct the file-revert section: two sources, the snapshot, byte-exactness, the coverage verdict. |
| `CHANGELOG.md`, `CHANGELOG.zh-CN.md` | Entries under `Unreleased` (both files). |
| `AGENTS.md` | The "A shell write is invisible" trap is no longer the whole truth — see the note already added. |
| `lib/` | **Rebuild and commit** (`npm run build`). `lib/` is the install artifact in this repository. |

## 5. Acceptance criteria

### 5.1 Commands (all must pass, in this order)

```sh
npm run typecheck          # clean
npm test                   # every suite green, including the three new/updated ones
npm run build              # then confirm lib/index.js and lib/client.js changed, and commit them
```

### 5.2 Behaviour the ported tests must assert

Each line is one assertion an implementer can write today; the first five are the ones the reference
implementation's `tests/revert.test.ts` and `tests/trees.test.ts` already carry.

1. A shell-written **binary** file comes back byte-for-byte; a shell-written text file comes back; a
   file the shell CREATED is moved into the quarantine; the write tool's file is handled too;
   `coverage === 'full'` and `unrestorable` is empty.
2. A range whose first turn has **no snapshot** and whose log contains a `tool/call` for `pwsh`:
   the shell-written file is NOT restored, `coverage === 'none'`, `coverageReason === 'noSnapshot'`,
   `tools === ['pwsh']`.
3. Two sessions in one process, same turn number, same path: a recall in the second restores the
   second's own before-image (not the first's).
4. `/rewind plan <n>` lists the shell-written file under `restore` (with the bytes it would write) and
   the shell-created file under `remove`, reports the coverage verdict, and changes nothing on disk.
5. `snapshotWorkspace: false` + a shell tool in the range → `coverage === 'none'`.
6. A snapshot captured with `maxFiles: 2` over a 5-file workspace: `complete === false`, the diff's
   `removalsSuppressed === true`, and no target has `before === null` (nothing may be called created).
7. A file recorded as `too-large` / `unreadable` / `symlink` in `uncaptured` is never a removal, and a
   change to it appears in the diff's `uncapturedChanged`.
8. A blob corrupted in place (bytes no longer matching its hash) → the path lands in the diff's
   `missing`, and `restore` is empty.
9. A workspace containing a symlinked/junctioned DIRECTORY → the snapshot is `complete: false` with
   reason `symlink`, and the linked subtree is not in `entries`.
10. Two writes to one path in one turn whose captures finish out of order → `changesForTurns` returns
    them ordered by write sequence (the earliest first).
11. Retention: the per-session turn cap, the manifest age and the blob byte budget each drop the
    oldest manifests and collect the blobs nothing references any more; a blob a capture is holding is
    never collected under it.

### 5.3 Must NOT (a reviewer will check these by reading)

- No file is deleted or moved without its bytes already sitting in the quarantine.
- `coverage: 'full'` is never reported when a tool whose writes the plugin cannot observe ran in the
  range and there is no snapshot for its first turn.
- No `@deepseek-ai/*` peerDependency is added.
- The `tools/pre-execute` listener cannot fail a tool call: it always returns `next()` and swallows its
  own errors.
- `write` and `edit` trigger the turn's snapshot (they are not on the read-only allowlist).
- Nothing writes outside `$DSH_HOME/storages/dsh-rewind-plugin/` and the quarantine, and the snapshot
  is never stored inside the workspace.

### 5.4 Manual smoke (optional, on a machine with a profile)

Install the built package into a profile, start a session in a scratch project, have the model run a
shell command that rewrites a PNG (or `Write-Output` into a file), then recall that turn: the PNG must
come back byte-for-byte and the quarantine must hold the displaced bytes.

## 6. Versioning and release (this repository's SOP)

- **MINOR**: `0.1.4` → `0.2.0`. It adds `Config` fields and new storage subdirectories, which
  `AGENTS.md` ("Public API") classes as an addition, not a patch.
- Both changelogs get the entry under `Unreleased`; write the entry before releasing.
- Rebuild `lib/`, commit it with the source, then follow the release sequence in `AGENTS.md`.

## 7. The verified reference implementation

Same machine, same lineage, already ported and verified:

```
D:\codes\DSH-APP\dsh-app\plugins\plugin-rewind\     (that port is at 0.1.3)
  src\trees.ts              the workspace snapshot store            (new)
  src\snapshots.ts          byte-exact before-images + quarantine
  src\recorder.ts           session + write-order keyed recorder
  src\index.ts              Config, the tools/pre-execute gate, the merge, the coverage verdict
  src\wire.ts               RevertCoverage + RevertPlan fields
  src\client.ts, src\client\messages.ts, src\client\confirm-dialog.tsx, src\client\locales.ts
  tests\trees.test.ts       the store's own suite                   (new)
  tests\revert.test.ts      the host half end to end                (new)
  tests\recorder.test.ts    isolation + write order
scratch\rewind-e2e\         hand-run probes: probe.mjs (multi-turn recall, sequential recalls,
                            session isolation), probe2.mjs (restart, capture race), probe4.mjs
                            (shell write restored byte-exact; no snapshot reported as none)
```

Port it, then adapt: this package's name/id, its storage root (`dsh-rewind-plugin`, not
`dsh-app-plugin-rewind`), its own `client.ts` error codes (`rewind.error.transport` and friends — keep
them), its own settings registration (`settings.section`, not a maintenance tab), its dictionary
namespace (`dsh-rewind`), and its committed `lib/`.

Verification the reference carries: `npm run typecheck` clean; 151/151 plugin tests; the port's own
repository gates and its 677-test root suite green; and every probe above passing (9 scenarios: the
multi-turn recall, sequential recalls, session isolation, a restarted plugin instance, the capture
race, and the shell-write/no-snapshot pair).

## 8. Deliberate limits (do not "fix" these without a decision)

- **Skipped directories stay outside coverage** (`node_modules`, VCS and cache directories; build
  output such as `dist/` is deliberately INSIDE). A recall that ran `npm install` therefore does not
  report the dependency tree. Flipping the verdict to `partial` for every project that has a
  `node_modules` would make the warning meaningless. Document it; do not silently widen it.
- **`size` + `mtime` unchanged means unchanged.** A writer that restores an old mtime at an unchanged
  size is missed. That is the same bargain every sync tool makes; the module header states the blind
  spot.
- **A snapshot is not a backup.** It covers one workspace, one turn, bounded — it is a restore source
  for a recall, and the quarantine is what makes a recall reversible.
