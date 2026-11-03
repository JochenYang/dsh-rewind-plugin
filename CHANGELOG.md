# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

**English** · [简体中文](CHANGELOG.zh-CN.md)

## [Unreleased]

### Fixed

- A tool call that arrived while the turn's workspace snapshot was still walking used to skip the
  wait, so its write landed in the tree being captured and the turn recorded a mid-turn state as its
  starting state — while the recall still reported `coverage: full`. Later callers now join the walk.
- The recorder's history is bounded, and trimming dropped the oldest before-images without telling
  the recall, so a range whose files had been trimmed still answered `full`. The recorder now names
  the newest `seq` it discarded and that range reports `partial` with reason `recorderTrimmed`.
- A participant that outlived its deadline was abandoned rather than stopped: the file revert kept
  writing after the recall answered "not restored", racing the user's retry on the same paths. The
  deadline now aborts it first, and the targets it never reached are reported as `cancelled`.
- A cancelled snapshot walk kept the turn's claim, so every later tool gate awaited a promise that
  recorded nothing. A walk that reports `complete: false` now releases it.
- Two restores in the same millisecond could share a quarantine slot — the stamp is millisecond-
  accurate and the path hash is a 32-bit fold — and the second overwrote the first displaced copy.
  The slot name now carries a random tail.
- A collection pass could delete the bytes a snapshot names. It scanned manifests and then deleted, so a
  capture that committed between those two steps was absent from its `referenced` set and its blobs
  looked like orphans. Measured with a collector looping beside two captures: 172–193 of 200 blobs
  deleted, leaving a snapshot that reads back as "every file changed" with the before-images gone. Each
  capture now releases only its own holds, and a capture's commit is serialized against the pass.

## [0.4.1] - 2026-10-26

### Changed

- Release assets now carry the version: the canonical file is `dsh-rewind-plugin-<x.y.z>.tgz`, so a
  download URL names the build it returns and keeps working after later releases. The version-free
  `dsh-rewind-plugin.tgz` stays as a floating alias because `releases/latest` needs one, and both files
  ship on every release from here on. `0.4.0` was backfilled with the versioned asset (the alias
  re-uploaded, not rebuilt); earlier releases keep the alias only.

### Fixed

- The confirmation dialog's file list is bounded and scrolls inside that bound. A recall that touched
  dozens of files rendered every row, so the dialog grew past the viewport and pushed the confirm
  button — the one control the dialog exists for — off screen.

## [0.4.0] - 2026-10-21

### Added

- A messages-only recall: `/rewind conversation <n>` cuts the messages and leaves every file alone, and
  the confirmation dialog offers the same choice as a scope control. This is the case where the file
  work was right and only the message was wrong — before it, the only way was to recall with files and
  put them back by hand. That scope KEEPS the range's before-images and snapshots: no file was touched,
  so those are the only record that could ever restore them, and dropping them would make the changes
  unrecoverable.
- `/rewind plan conversation <n>` — the preview answers for the scope the recall will use, so the
  dialog never lists a file it will not touch.

### Changed

- The workspace snapshot is taken when a turn OPENS, not at the turn's first writing tool. That earlier
  moment came after the user may have edited files by hand, so a recall treated those edits as the
  range's own work and undid them; a recall now returns the directory to the state it had when the
  message was sent. A failed snapshot releases its claim, so the tool gate can still take one later in
  the turn.

### Fixed

- The messages-only preview resolved ordinal 0 because the preview verbs were enumerated by hand when
  the ordinal was extracted and the new one was missing from that list; a perfectly recallable message
  was answered as "cannot recall". The ordinal is now read from the parsed variant.


## [0.3.0] - 2026-10-17

### Added

- The compaction boundary, named wherever a recall's list ends: the listing, an out-of-range answer, the
  picker and the confirmation dialog now say that messages before the newest compaction are no longer
  recallable, instead of offering a shorter list without a reason.
- A `dsh-rewind-participants` service, so another plugin can restore its own state after a recall. The
  file revert is its first participant, which is what proves the seam works.

### Changed

- A recall runs its participants after the surface write and before it drops the range's before-images
  and snapshots, so a participant can still read both.

## [0.2.0] - 2026-10-14

### Added

- The official desktop client's install steps, which are not a command: its `desktop` profile is
  reserved for the Electron application, so the plugin is added from inside the app.
- A bounded workspace snapshot as a second before-image source, taken before a turn's first writing
  tool and stored content-addressed under `$DSH_HOME/storages/dsh-rewind-plugin/{trees,blobs}`, so a
  file a shell command rewrote can be restored.
- A `coverage` verdict (`full` / `partial` / `none`) with its reason and the writing tools involved,
  carried on the command result and shown in the confirmation dialog.

### Changed

- Before-images are bytes, not text, so a binary file comes back byte for byte.
- The recorder is keyed by session as well as turn, and a path's before-images are ordered by write
  sequence instead of by the order their captures happened to finish.

### Fixed

- A file written by a shell command was neither restored nor reported: a recall answered a clean
  success over a tree it had only partly put back.
- A recall could restore another session's before-image when two sessions had a turn with the same
  number writing the same path.
- A range with no snapshot at all was reported exactly like "nothing changed".
- Restoring a binary file corrupted it, because before-images were read and written as `utf8`.
- Two writes to one path in one turn could restore the later before-image.

## [0.1.4] - 2026-10-09

### Added

- A screenshot of the confirmation dialog, embedded in both readmes and declared in `screenshots.json`
  so storefronts show it.

### Changed

- The changelog now has a Simplified Chinese mirror, cross-linked from both files.

## [0.1.3] - 2026-10-09

### Changed

- The built halves (`lib/`) are committed, so `dsh plugin add github:JochenYang/dsh-rewind-plugin`
  installs without a build step: pnpm refuses to run a git dependency's build script unless the
  installing profile allowlists it. `prepublishOnly` still rebuilds before every registry release.

## [0.1.2] - 2026-10-09

### Fixed

- The README the npm page renders: the title, icon, language switch and badges are centred, and the
  install section gives copy-pasteable commands instead of `<profile>` / `<version>` placeholders.

## [0.1.1] - 2026-10-09

First published release.

### Added

- `/rewind`: bare lists the recallable messages, `/rewind <n>` recalls one, and `/rewind plan <n>`
  previews a recall without performing it.
- A recall icon on hover for each user message, and a picker for the bare command.
- The recalled message's original text back in the composer, once per recall.
- File revert: every file the recalled turns changed is put back to its before-image, and a file the
  range created is moved into the quarantine instead of being deleted.
- `Settings → Recall quarantine`: one page listing every displaced file by session, with per-row and
  per-session discard behind a confirm.
- The `rewindAnchors` session projection, so the client never folds session events itself.

## [0.1.0] - 2026-10-09

### Added

- The port itself: the `@dsh-app` suite's rewind plugin adapted into a standalone package for stock
  DeepSeek Harness. Never published; `0.1.1` is the first release.

[Unreleased]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.1.4...v0.2.0
[0.1.4]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/JochenYang/dsh-rewind-plugin/releases/tag/v0.1.1
[0.1.0]: https://github.com/JochenYang/dsh-rewind-plugin/commit/5ae12fe
