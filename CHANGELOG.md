# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

**English** · [简体中文](CHANGELOG.zh-CN.md)

## [Unreleased]

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

[Unreleased]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.1.4...v0.2.0
[0.1.4]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/JochenYang/dsh-rewind-plugin/releases/tag/v0.1.1
[0.1.0]: https://github.com/JochenYang/dsh-rewind-plugin/commit/5ae12fe
