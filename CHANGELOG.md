# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

**English** · [简体中文](CHANGELOG.zh-CN.md)

## [Unreleased]

### Added

- The official desktop client's install steps, which are not a command: its `desktop` profile is
  reserved for the Electron application, so the plugin is added from inside the app.

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

[Unreleased]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/JochenYang/dsh-rewind-plugin/releases/tag/v0.1.1
[0.1.0]: https://github.com/JochenYang/dsh-rewind-plugin/commit/5ae12fe
