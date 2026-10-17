<h1 align="center">dsh-rewind-plugin</h1>

<p align="center">
  <img src="icon.svg" width="96" height="96" alt="dsh-rewind-plugin">
</p>

<p align="center">
  <a href="README.md">English</a> · 简体中文
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@jochenyang/dsh-rewind-plugin"><img src="https://img.shields.io/npm/v/@jochenyang%2Fdsh-rewind-plugin?style=flat-square" alt="npm"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/JochenYang/dsh-rewind-plugin?style=flat-square" alt="license"></a>
  <a href="https://github.com/JochenYang/dsh-rewind-plugin/stargazers"><img src="https://img.shields.io/github/stars/JochenYang/dsh-rewind-plugin?style=flat-square" alt="stars"></a>
  <a href="https://github.com/JochenYang/dsh-rewind-plugin/issues"><img src="https://img.shields.io/github/issues/JochenYang/dsh-rewind-plugin?style=flat-square" alt="issues"></a>
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/DSH-0.2.0--rc.2-4176e6?style=flat-square" alt="DSH 0.2.0-rc.2"></a>
  <a href="https://github.com/topics/dsh-plugin"><img src="https://img.shields.io/badge/topic-dsh--plugin-4176e6?style=flat-square" alt="topic dsh-plugin"></a>
</p>

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 用的消息撤回：把会话退回到某条
已发送消息之前。

已发送的消息改不了也收不回。这个插件把模型可见的对话表面裁到某条用户消息之前：这条消息及其之后的
内容退出模型上下文、从对话界面隐藏，原文回到输入框，可以改完重发。被撤回的那些回合改动过的文件会
逐字节恢复原样，而每一个被移走的字节都留在隔离区里，可以查看、可以清空。如果这次撤回没能覆盖全部
改动，结果会如实说明，而不是谎称已经完整还原。

## 效果

![撤回前的确认框：会改动 1 个文件，附改动前后的差异；被移走的字节进隔离区](assets/recall-confirm.png)

撤回前的确认框：这次撤回会改动哪些文件、每个文件的真实前后差异，以及挡路的那些字节最后去了哪里。
不会删除任何东西。

## 它带来什么

| 位置                  | 说明                                                                             |
|-----------------------|----------------------------------------------------------------------------------|
| 每条消息上的撤回图标  | 把鼠标停在对话里的一条用户消息上                                                 |
| `/rewind`             | 留空列出可撤回的消息；`/rewind <n>` 撤回第 n 条；`/rewind plan <n>` 只看预览不动手 |
| 输入框回填            | 被撤回消息的原文回到输入框，一次撤回只回填一次                                    |
| **设置 → 撤回隔离区** | 设置里独立的一页：按会话分组列出每个被移走的文件，逐条或整段清空，清空前有一次确认  |

隔离区这一页注册在 `settings.section`——设置外壳自己留给功能插件的座位，所以它和内置的「通用 / 模型 /
插件」并列。没有设置外壳的 profile 只是少这一页，其余功能不受影响。

撤回会在最近一次压缩处停下：压缩把被总结的历史换成一条 checkpoint 消息，它之前的提示不再是模型可见
表面上的节点，列表也就无法提供它们。`/rewind` 会把这件事说出来：列表、越界回答、选择器和确认框都会
点名这条压缩边界，而不是只给一个更短的列表。

## 安装

```sh
# 从 registry 装
dsh plugin --profile web add @jochenyang/dsh-rewind-plugin

# 或者直接用 Release 里的 tgz，不经过 registry
dsh plugin --profile web add https://github.com/JochenYang/dsh-rewind-plugin/releases/latest/download/dsh-rewind-plugin.tgz

# 或者从仓库装，安装时自动构建
dsh plugin --profile web add github:JochenYang/dsh-rewind-plugin
```

并把包名追加到 `dsh.profile.bundles`；重启这个 profile 才会加载它。

**官方桌面端没有对应的命令行。** 它的 `desktop` profile 由 Electron 应用独占，CLI 会直接拒绝
（`error: profile "desktop" is managed exclusively by the Electron application`）。请在应用内安装：
**设置 → 插件 → 添加插件**，在「包名或地址」里填 `@jochenyang/dsh-rewind-plugin`，安装后重启应用。
这个输入框同样接受 Git 地址、本地目录和 `.tgz` 压缩包，界面也会提示「已安装，下次启动后加载」。
并把包名追加到 `dsh.profile.bundles`；重启这个 profile 才会加载它。

`peerDependencies` 里刻意不写任何 `@deepseek-ai/dsh-*`：安装器会把每一个这类 peer 与当前运行版本做
比较，不满足就拒绝安装，那等于把这个插件限制在某一个 DSH 版本上。而这个插件运行起来不需要额外安装任何
东西——下面列的运行时包在任何 DSH profile 里都已经存在——所以跳过这项校验，任何运行版本都能装上。
代价是明确的：将来某个 DSH 版本改了这些接口，插件会装上并在调用时失败，而不是在安装时被拒。

## 为什么不会丢东西

会话日志只追加，它始终是唯一的事实来源。一次撤回只追加一条带
`surfaceOp: { op: 'replace', startSeq, endSeq }` 的事件，所以日志里每个事件都还在；不理会 surface op
的读取方看到的仍是完整对话。

文件从不被删除。挡路的那些字节先被移进
`$DSH_HOME/storages/dsh-rewind-plugin/quarantine/<会话>/<槽位>/`（连同写明原路径的 `manifest.json`），
然后才写回改动前的版本。被撤回区间新建出来的文件也是移进去，而不是删掉。

撤回需要知道这个区间的起点长什么样，所以插件会在一个回合里第一个「可能写入」的工具之前，给工作区
拍一份有上限的副本，按内容寻址存到 `$DSH_HOME/storages/dsh-rewind-plugin/{trees,blobs}`。命令行命令
改写过的文件之所以能还原，靠的就是这份副本：`write` / `edit` 这两条瀑布仍然提供它们能看到的精确改动前
镜像，而快照覆盖到的路径以快照的字节为准。

## 给其他插件

撤回会改动会话表面与工作区。任何镜像过某个回合的插件——看板、归档、任务清单——也得把自己的状态收回来，
所以宿主这一半发布了 `dsh-rewind-participants` 服务。在自己的 `inject` 里声明它，调用
`register({ id, reconcileAfterRewind })`，之后每次撤回都会在写入会话表面之后按注册顺序运行你的参与者。
抛错或超过 30 秒截止时间的参与者会被记进日志并跳过，不会让撤回失败；命令按 id 收集每个参与者的结果
（随结果返回的是文件还原的那份报告）。文件还原本身就是第一个参与者，这条接缝就是插件自己正在走的路。

## 运行时需要什么

从 profile 里解析，不打包进产物：

`@deepseek-ai/cordis`、`@deepseek-ai/dsh-commands`、`@deepseek-ai/dsh-session`、
`@deepseek-ai/dsh-session-projection`、`@deepseek-ai/dsh-llm`、`@deepseek-ai/dsh-home-paths`、
`@deepseek-ai/dsh-client-connection`、`@deepseek-ai/schemastery`、`zod`。

浏览器半边只需要 `react`、`react/jsx-runtime`、`react-dom/client` 与
`@deepseek-ai/dsh-client-ui-primitives`，这四者由外壳自己的模块表提供。它们不写进
`dsh.client.external`，因为外壳本来就能回答。

## 使用注意

- **一个会话同时只有一个写入者。** DSH 对每个会话持有一把跨进程独占写锁，直到写句柄关闭才释放。
  因此共用同一个 `$DSH_HOME` 的两个 DSH 进程无法同时写同一个会话：后者的命令执行会被
  `session/writer-held` 拒绝，撤回则会报「请求没能送到内核」。第二个实例**读**同一个会话没问题，
  不同会话之间也从不冲突——把那个会话在另一个窗口里关掉，或者换一个会话继续。
- 撤回需要 agent 处于空闲。正在跑的回合会被直接拒绝而不是去抢，因为从回合中间裁剪会让该回合后面的
  工具结果失去对应的调用。

## 已知限制

- 由本插件观察不到其写入的工具改动的文件——命令行命令、模型跑的脚本、渲染器——由工作区快照负责，
  而不是那两条写入瀑布。快照是有上限的（文件数、总字节、单文件字节、截止时间，以及工具调用的 abort
  signal），所以特别大的目录树、读不了的文件、符号链接或超时的遍历都可能留下没覆盖到的路径。每次撤回
  都会报告覆盖度——`full`、`partial` 或 `none`——连同原因和涉及的写入工具，缺口是看得见的，而不是静默的。
- 依赖、版本控制与缓存目录（`node_modules`、`.git` 等）故意不在覆盖范围内，所以跑过 `npm install` 的
  撤回不会报告依赖树；而 `dist/` 这类构建产物是会被遍历的。
- `size` + `mtime` 都没变就当作没变。一个把旧 mtime 恢复回来、大小又刚好相同的写入者会被漏掉——这是
  所有同步工具都要做的取舍。
- 占位符是一条内容为空的 `user/message`。DeepSeek 的请求构造会丢掉空的用户消息，所以它在那边不产生
  面向模型的回合；换成不丢空用户内容的 provider，一次撤回会多出一条空的用户消息。

## 开发

```sh
npm install
npm run build      # 产出 lib/index.js + lib/client.js
npm run typecheck
npm test           # 用 esbuild 打包 tests/*.test.ts，再跑 node --test
```

`npm run build` 把 `@deepseek-ai/*`、`@cordisjs/*`、`react`、`react-dom`、`zod` 标为外部依赖，并把
浏览器半边包进 web 客户端要求的 `window.__ModuleLoader__.load({ id, factory })` 闭包。不要把任何
`@deepseek-ai/*` 打进产物：第二份拷贝会让类身份对不上运行中的宿主。

`lib/` 已入库，所以 `dsh plugin add github:JochenYang/dsh-rewind-plugin` 不需要构建就能装——
pnpm 默认拒绝运行 git 依赖的构建脚本，除非该 profile 把它加进允许名单。改过 `src/` 之后跑一次
`npm run build`；`prepublishOnly` 会在发布到 registry 前做同一件事。

## 目录

| 路径                                                   | 内容                                           |
|--------------------------------------------------------|------------------------------------------------|
| `src/index.ts`                                         | host 半边：`/rewind` 命令、写入记录器、快照与回滚 |
| `src/cut.ts`                                           | 撤回计算：锚点、替换范围、占位符                  |
| `src/projection.ts`                                    | `rewindAnchors` 投影，客户端全部的读取面        |
| `src/routes.ts`、`src/quarantine.ts`、`src/snapshots.ts` | 隔离区的 HTTP 路由、列表与清空、改动前的镜像     |
| `src/trees.ts`                                         | 工作区快照存储与它的保留策略                    |
| `src/recorder.ts`                                      | 哪个文件改动属于哪个回合                       |
| `src/wire.ts`                                          | 两半共用的载荷形状与错误码                     |
| `src/client.ts`                                        | 客户端半边：图标、选择器、回填、隐藏回合、设置页    |
| `src/client/`                                          | 组件、中英文案、注入的样式表                     |
| `cordis.patch.yml`                                     | 挂载插件的唯一一行 insert                      |

## 更新日志与版本号

每个版本都记在 [CHANGELOG.md](CHANGELOG.md) 里，格式遵循
[Keep a Changelog 1.1.0](https://keepachangelog.com/zh-CN/1.1.0/)；版本号遵循
[语义化版本 2.0.0](https://semver.org/lang/zh-CN/)。中文版即本文件对应的
[CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md)。

## 许可

[MIT](LICENSE)
