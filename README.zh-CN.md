<img src="icon.svg" alt="" width="76" height="76" align="center">

# dsh-rewind-plugin

[English](README.md) · **简体中文**

[![npm](https://img.shields.io/npm/v/@jochenyang%2Fdsh-rewind-plugin?style=flat-square)](https://www.npmjs.com/package/@jochenyang/dsh-rewind-plugin)
[![License](https://img.shields.io/github/license/JochenYang/dsh-rewind-plugin?style=flat-square)](LICENSE)
[![Stars](https://img.shields.io/github/stars/JochenYang/dsh-rewind-plugin?style=flat-square)](https://github.com/JochenYang/dsh-rewind-plugin/stargazers)
[![Issues](https://img.shields.io/github/issues/JochenYang/dsh-rewind-plugin?style=flat-square)](https://github.com/JochenYang/dsh-rewind-plugin/issues)
[![DSH](https://img.shields.io/badge/DSH-0.2.0--rc.2-4176e6?style=flat-square)](https://github.com/deepseek-ai/deepseek-harness)
[![Topic](https://img.shields.io/badge/topic-dsh--plugin-4176e6?style=flat-square)](https://github.com/topics/dsh-plugin)

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 用的消息撤回：把会话退回到某条
已发送消息之前。

已发送的消息改不了也收不回。这个插件把模型可见的对话表面裁到某条用户消息之前：这条消息及其之后的
内容退出模型上下文、从对话界面隐藏，原文回到输入框，可以改完重发。被撤回的那些回合改动过的文件会
恢复原样，而每一个被移走的字节都留在隔离区里，可以查看、可以清空。

## 它带来什么

| 位置                  | 说明                                                                             |
|-----------------------|----------------------------------------------------------------------------------|
| 每条消息上的撤回图标  | 把鼠标停在对话里的一条用户消息上                                                 |
| `/rewind`             | 留空列出可撤回的消息；`/rewind <n>` 撤回第 n 条；`/rewind plan <n>` 只看预览不动手 |
| 输入框回填            | 被撤回消息的原文回到输入框，一次撤回只回填一次                                    |
| **设置 → 撤回隔离区** | 设置里独立的一页：按会话分组列出每个被移走的文件，逐条或整段清空，清空前有一次确认  |

隔离区这一页注册在 `settings.section`——设置外壳自己留给功能插件的座位，所以它和内置的「通用 / 模型 /
插件」并列。没有设置外壳的 profile 只是少这一页，其余功能不受影响。

## 安装

```sh
# 从 registry 装
dsh plugin --profile <profile> add @jochenyang/dsh-rewind-plugin

# 或者用打包好的 tgz，不经过 registry
npm pack          # 或者从 Releases 下载 .tgz
dsh plugin --profile <profile> add /绝对路径/dsh-rewind-plugin-<版本>.tgz
```

两种方式都会把这个包写进该 profile 的依赖，并把包名追加到 `dsh.profile.bundles`。重启这个 profile
才会加载它。

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

- 由命令行命令改动的文件，或者任何绕开通道、用自己的文件句柄写入的工具，都不会经过
  `fs/write-intent` / `fs/edit-intent` 这两条瀑布。这类改动无法恢复，确认对话框和结果都会如实说明，
  不会谎称已经完整还原。
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

## 目录

| 路径                                                   | 内容                                           |
|--------------------------------------------------------|------------------------------------------------|
| `src/index.ts`                                         | host 半边：`/rewind` 命令、写入记录器、快照与回滚 |
| `src/cut.ts`                                           | 撤回计算：锚点、替换范围、占位符                  |
| `src/projection.ts`                                    | `rewindAnchors` 投影，客户端全部的读取面        |
| `src/routes.ts`、`src/quarantine.ts`、`src/snapshots.ts` | 隔离区的 HTTP 路由、列表与清空、改动前的镜像     |
| `src/recorder.ts`                                      | 哪个文件改动属于哪个回合                       |
| `src/wire.ts`                                          | 两半共用的载荷形状与错误码                     |
| `src/client.ts`                                        | 客户端半边：图标、选择器、回填、隐藏回合、设置页    |
| `src/client/`                                          | 组件、中英文案、注入的样式表                     |
| `cordis.patch.yml`                                     | 挂载插件的唯一一行 insert                      |

## 许可

[MIT](LICENSE)
