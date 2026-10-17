# 更新日志

本项目的所有重要变更都记录在这个文件里。

格式遵循 [Keep a Changelog 1.1.0](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本 2.0.0](https://semver.org/lang/zh-CN/)。

[English](CHANGELOG.md) · **简体中文**

## [Unreleased]

## [0.3.0] - 2026-10-17

### Added

- 压缩边界：撤回列表止于最近一次压缩时，列表、越界回答、选择器和确认框都会说明「压缩边界之前的消息
  已经无法撤回」，而不是只给一个更短的列表。
- `dsh-rewind-participants` 服务：其他插件可以注册参与者在撤回后恢复自己的状态；文件还原本身就是
  第一个参与者，用来证明这条接缝可用。

### Changed

- 一次撤回先写回会话表面，再依次运行参与者，最后才丢弃该区间的改动前镜像与快照，参与者因此还能读到两者。

## [0.2.0] - 2026-10-14

### Added

- 官方桌面端的安装步骤（它不是一条命令）：`desktop` profile 由 Electron 应用独占，只能在应用内添加。
- 工作区快照作为第二个改动前来源：在一个回合里第一个「可能写入」的工具之前拍摄，按内容寻址存到
  `$DSH_HOME/storages/dsh-rewind-plugin/{trees,blobs}`，命令行命令改写过的文件因此也能还原。
- 覆盖度判定（`full` / `partial` / `none`），连同原因与涉及的写入工具，随命令结果返回并显示在确认框里。

### Changed

- 改动前的镜像改为按字节保存，不再是文本，二进制文件因此能逐字节还原。
- 记录器同时以会话和回合为键；同一路径的多个改动前镜像按写入顺序排序，而不是按抓取完成的先后。

### Fixed

- 由命令行命令写入的文件既没有还原也没有报告：撤回会对只还原了一部分的工作区回答「成功」。
- 两个会话各有同号回合、写同一个路径时，撤回可能还原成另一个会话的改动前镜像。
- 完全没有快照的区间被报成与「没有任何改动」一模一样。
- 还原二进制文件会损坏它，因为改动前的镜像是按 `utf8` 读写。
- 同一回合里对同一路径的两次写入，可能还原成后一次之前的镜像。

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

[Unreleased]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.1.4...v0.2.0
[0.1.4]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/JochenYang/dsh-rewind-plugin/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/JochenYang/dsh-rewind-plugin/releases/tag/v0.1.1
[0.1.0]: https://github.com/JochenYang/dsh-rewind-plugin/commit/5ae12fe
