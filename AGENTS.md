# AGENTS.md

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) plugin that adds
message recall: it cuts the conversation back to before a message you already sent, hides it in the
transcript, puts its text back in the composer, and keeps every displaced file in a quarantine you
can review.

This file is the working brief for a coding agent. `README.md` is for users; this is for whoever
changes the code.

## Commands

```sh
npm install          # devDependencies only — the published package needs none
npm run build        # src/ -> lib/index.js (host) + lib/client.js (browser)
npm run typecheck    # tsc --noEmit over src/ (tests are bundled by esbuild, not typechecked)
npm test             # bundles tests/*.test.ts into .test-dist/, then node --test
npm pack             # the tarball both the registry and the GitHub Release ship
```

`lib/` is **committed**. It is the install artifact for `dsh plugin add github:…`, which must not need
a build step: pnpm refuses to run a git dependency's build script unless the installing profile
allowlists it. Run `npm run build` after changing `src/` and commit the rebuilt `lib/` with it.
`prepublishOnly` rebuilds before a registry release, so a published tarball is never stale.

## What the pieces are

| path | what lives there |
|---|---|
| `src/index.ts` | host half: the `/rewind` command, the write recorder, the snapshot/revert path |
| `src/cut.ts` | the recall computation — anchors, the replacement range, the placeholder |
| `src/projection.ts` | the `rewindAnchors` projection, the client's entire read face |
| `src/recorder.ts` | which file change belongs to which turn |
| `src/snapshots.ts` | before-images, and the quarantine directory layout |
| `src/quarantine.ts`, `src/routes.ts` | the manager's listing/purge and its host routes |
| `src/wire.ts` | payload shapes and error codes both halves share |
| `src/client.ts`, `src/client/` | browser half: icon, picker, prefill, hidden turns, Settings page |
| `cordis.patch.yml` | the one `insert` row that mounts the plugin |
| `tests/port.test.ts` | guards on the standalone-package contract (see Traps) |

Three mechanisms carry the design. Read the module header before changing any of them:

1. **The cut is a surface replacement.** A recall appends one `user/message` carrying
   `surfaceOp: { op: 'replace', … }`; the session log stays append-only and nothing is deleted. The
   placeholder must be a `user/message`, never a `system/message` — the persistence validator requires
   a system message to match the currently open turn and step, and a recall runs while the agent is
   idle, which makes such a session unloadable.
2. **The projection is the client's only read face.** Recall points, shadowed ranges and the hidden
   turn list are folded on the host; the browser half never folds session events.
3. **The quarantine is the safety net.** Every displaced file's current bytes are moved into
   `$DSH_HOME/storages/dsh-rewind-plugin/quarantine/<session>/<slot>/` beside a `manifest.json` naming
   the original path, and only then is the before-image written back.

## Public API (what SemVer protects)

The package follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html). These are the
surfaces a user or another plugin can depend on, so changing one is a version decision:

- the `/rewind` command name and its argument grammar (bare, `<n>`, `plan <n>`);
- the `rewindAnchors` projection key and the shape of its value;
- the plugin `Config` field `maxAnchors`;
- the coded host answers (`rewind.host.*`) the client dictionary keys on;
- the quarantine routes and their prefix `/api/plugins/dsh-rewind-plugin`;
- the quarantine directory layout under `$DSH_HOME/storages/dsh-rewind-plugin/`;
- the package name, and the `dsh.bundle` / `dsh.client` manifest keys.

Since 0.x the API is not stable by definition, but bump as if it were: adding a command argument, a
setting or a route is MINOR, correcting behaviour without touching those surfaces is PATCH, and any
change to the list above is MAJOR (a pre-1.0 MAJOR, i.e. `0.(y+1).0`). A published version's content
is never edited — a fix is a new version.

## Changelog and releases

`CHANGELOG.md` follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/): an `Unreleased`
section at the top, one entry per released version with an ISO date, changes grouped under Added /
Changed / Deprecated / Removed / Fixed / Security, newest first, and a comparison link per version.
Write the entry, then release — not the other way round.

Release sequence:

```sh
# 1. move Unreleased into a new version heading with today's date (ISO)
# 2. bump and build
npm version <x.y.z> --no-git-tag-version
npm run build && npm run typecheck && npm test
git add -A && git commit -m 'chore(release): <x.y.z>' && git push
# 3. publish, then attach the same tarball to the release
npm publish
npm pack --pack-destination <dir> && cp <dir>/<name>-<x.y.z>.tgz <dir>/dsh-rewind-plugin.tgz
gh release create v<x.y.z> <dir>/dsh-rewind-plugin.tgz --title 'v<x.y.z>' --notes '…' --latest
```

Keep the Release asset name **version-free** (`dsh-rewind-plugin.tgz`): `README.md` links
`releases/latest/download/dsh-rewind-plugin.tgz`, and a versioned asset name would 404 the moment the
next release is cut.

Publishing needs a token: `$env:NPM_TOKEN` is not in the process environment, it lives in the User
scope — inject it with
`$env:NPM_TOKEN = [System.Environment]::GetEnvironmentVariable('NPM_TOKEN','User')` before `npm publish`,
or `npm whoami` fails with 401. That token's npm identity has publish rights to the `@jochenyang` scope.

## Conventions

- TypeScript strict. Every framework import is type-only unless it is used as a value; the framework
  packages are resolved from the profile at run time and must never be bundled.
- `lib/` is produced by `scripts/build-lib.mjs`, which marks `@deepseek-ai/*`, `@cordisjs/*`, `react`,
  `react-dom` and `zod` external. Bundling an `@deepseek-ai/*` package breaks class identity against
  the running host; bundling a second `zod` makes the projection schema foreign to the registry.
- Comments state intent, constraints and non-obvious exceptions. Several modules carry a "why the
  obvious version is wrong" header — keep those accurate when you change the code, they are the
  cheapest defence against reintroducing a fixed bug.
- Client styles use `--dsw-*` theme tokens only, never literal colours, and every class carries the
  `dshRewind-` prefix. `tests/styles.test.ts` enforces both, plus brace balance.
- User-visible copy lives in `src/client/locales.ts` in **both** dictionaries: `zh` is the source of
  truth for the key union and the English table is typed with it, so a missing or extra key fails the
  build. The host half never sends prose — it sends a code plus the values its sentence interpolates.
- Adding a settings page? It goes into `settings.section`, the seat the settings shell declares. Do
  not invent a slot key: registration on an undeclared key is a runtime throw.

## Traps already paid for

- **One writer per session.** DSH takes a cross-process exclusive write lock per session, held for the
  life of a write handle. Two `dsh` processes sharing `$DSH_HOME` cannot both write the same session:
  the second one's command execution fails with `session/writer-held`, and recall reports that the
  request never reached the kernel. Reading is fine; different sessions never conflict. This is why
  `src/client.ts` distinguishes "the transport refused" (`rewind.error.transport`, carrying the
  kernel's own sentence) from "a capability is missing".
- **A shell write is invisible.** `fs/write-intent` / `fs/edit-intent` are dispatched by `dsh-tool-fs`
  only, so a file changed by a command cannot be reverted. The confirmation dialog and the result say
  so; never let the plugin claim a clean revert.
- **The waterfall's second argument is private.** The event publishes `actor: object | undefined`, and
  the turn is read from `exec.agent.session`. When it is absent the recorder reports it rather than
  filing the change under no turn, which used to look exactly like a clean recall.
- **No `@deepseek-ai/dsh-*` peerDependencies.** The installer compares those against the running
  runtime version and refuses the install on a mismatch, which would pin the plugin to one DSH
  release. `tests/port.test.ts` fails if one is added back.
- **The bundle patch's `name` is the package name** — the row is skipped with a warning otherwise —
  and a scoped name must be quoted, because a leading `@` is a YAML indicator. The loader id in
  `build.mjs` must equal the package name too. `tests/port.test.ts` asserts all three.
- **A recall needs an idle agent.** A running turn is refused rather than raced: cutting mid-turn
  leaves that turn's tool results without their call, and a provider rejects such a transcript.
- **The empty placeholder is provider-dependent.** The DeepSeek request path drops an empty user
  message; a provider that does not would see one extra empty message per recall.

## Tests

`npm test` is the whole gate. Two kinds live here:

- **Behaviour suites** (`cut`, `projection`, `quarantine`, `routes`, `recorder`, `snapshots`,
  `anchors`, `persist`, `live-hooks`, …) exercise the host logic directly, mostly against real
  `Session` objects.
- **Source-reading guards** (`inject`, `styles`, `messages`, `port`, `locales`) read the tree as text.
  That is deliberate: the client half's wiring cannot be exercised without a browser, and these catch
  the regressions that are otherwise silent — a dropped `inject` entry, a reverted slot key, a peer
  that would block installation.

Add a test with every behaviour change. If a bug was measured on a real machine, say so in the test's
comment: those notes are why the suite is trusted.

## Commits

`<type>(<scope>): <subject>` — English imperative, lowercase, no trailing period, subject ≤ 50
characters. Types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `perf`, `ci`, `build`,
`revert`. Body: 2–4 `-` bullets, each ≤ 72 characters, one logical change per bullet. End with a
`Verified:` paragraph naming what was actually run.
