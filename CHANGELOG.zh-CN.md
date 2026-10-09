# 更新日志

本项目的所有重要变更都记录在这个文件里。

格式遵循 [Keep a Changelog 1.1.0](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本 2.0.0](https://semver.org/lang/zh-CN/)。

[English](CHANGELOG.md) · **简体中文**

## [Unreleased]

### Added

- 官方桌面端的安装步骤（它不是一条命令）：`desktop` profile 由 Electron 应用独占，只能在应用内添加。

## [0.1.4] - 2026-10-09

### Added

- 撤回确认框的截图：嵌进两份 README，并在 `screenshots.json` 里声明，供插件市场展示。

### Changed

- 更新日志增加简体中文镜像，两份文件互相链接。

## [0.1.3] - 2026-10-09

### Changed

- 构建产物 `lib/` 一并入库，于是 `dsh plugin add github:JochenYang/dsh-rewind-plugin` 不再需要构建
  步骤：pnpm 默认拒绝运行 git 依赖的构建脚本，除非安装方 profile 把它加进允许名单。`prepublishOnly`
  仍会在每次发布 registry 版本前从源码重建。

## [0.1.2] - 2026-10-09

### Fixed

- npm 页面上渲染的那份 README：标题、图标、语言切换与徽章改为居中，安装那节给出可直接复制的命令，
  不再使用 `<profile>` / `<version>` 这类占位符。

## [0.1.1] - 2026-10-09

首个发布版本。

### Added

- `/rewind`：留空列出可撤回的消息，`/rewind <n>` 撤回第 n 条，`/rewind plan <n>` 只看预览不动手。
- 悬停每条用户消息时出现的撤回图标，以及裸命令的列表选择器。
- 被撤回消息的原文回到输入框，一次撤回只回填一次。
- 文件回滚：被撤回回合改动过的文件还原成改动前的内容，该区间新建的文件移进隔离区而不是删除。
- 「设置 → 撤回隔离区」：一页按会话列出所有被移走的文件，逐条或整段清空，清空前有一次确认。
- `rewindAnchors` 会话投影，客户端因此不需要自己折会话事件。

## [0.1.0] - 2026-10-09

### Added

- 移植本身：把 `@dsh-app` 套件里的 rewind 插件改造成面向标准 DeepSeek Harness 的独立包。
  从未发布；`0.1.1` 是首个发布版本。

[Unreleased]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/JochenYang/dsh-rewind-plugin/releases/tag/v0.1.1
[0.1.0]: https://github.com/JochenYang/dsh-rewind-plugin/commit/5ae12fe
