window.__ModuleLoader__.load({ id: "@jochenyang/dsh-rewind-plugin", factory: (require) => {
var module = { exports: {} };
var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.ts
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);

// src/client/message-action.tsx
var import_react4 = require("react");
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/confirm-dialog.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime = require("react/jsx-runtime");
function baseName(path) {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? path;
}
function diffLabels(t) {
  return {
    codeLabel: "",
    wrapLabel: t("rewind.diff.wrap"),
    unwrapLabel: t("rewind.diff.unwrap"),
    copy: t("rewind.diff.copy"),
    copied: t("rewind.diff.copied"),
    collapseAria: t("rewind.diff.collapseAria"),
    expandAria: (count) => t("rewind.diff.expandAria", { count }),
    collapse: t("rewind.diff.collapse"),
    expand: (count) => t("rewind.diff.expand", { count })
  };
}
function ConfirmDialog({ open, plan, busy, t, onConfirm, onClose }) {
  const [expanded, setExpanded] = (0, import_react.useState)(void 0);
  (0, import_react.useEffect)(() => {
    if (!open) setExpanded(void 0);
  }, [open]);
  if (!open) return null;
  const restore = plan?.restore ?? [];
  const remove = plan?.remove ?? [];
  const unrestorable = plan?.unrestorable ?? [];
  const rows = [...restore, ...remove];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    import_dsh_client_ui_primitives.Modal,
    {
      open,
      onClose,
      title: t("rewind.confirm.title"),
      closeLabel: t("rewind.confirm.cancel"),
      className: "dshRewind-confirmDialog",
      description: rows.length === 0 ? t("rewind.confirm.nofiles") : t("rewind.confirm.summary", { files: rows.length }),
      footer: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", disabled: busy, onClick: onClose, children: t("rewind.confirm.cancel") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "primary", disabled: busy, onClick: onConfirm, children: busy ? t("rewind.confirm.working") : t("rewind.confirm.confirm") })
      ] }),
      children: [
        rows.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { className: "dshRewind-fileList", children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { className: "dshRewind-fileRow", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dshRewind-fileHead", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dshRewind-fileAction", "data-action": row.action, children: row.action === "restore" ? t("rewind.confirm.restore") : t("rewind.confirm.remove") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dshRewind-filePath", title: row.path, children: baseName(row.path) }),
            row.action === "restore" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              import_dsh_client_ui_primitives.Button,
              {
                variant: "ghost",
                size: "sm",
                "aria-expanded": expanded === row.path,
                onClick: () => setExpanded((current2) => current2 === row.path ? void 0 : row.path),
                children: expanded === row.path ? t("rewind.confirm.hideDiff") : t("rewind.confirm.showDiff")
              }
            )
          ] }),
          expanded === row.path && row.action === "restore" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_dsh_client_ui_primitives.DiffBlock,
            {
              diffs: [{ path: row.path, oldText: row.current ?? "", newText: row.next ?? "" }],
              labels: diffLabels(t),
              maxLines: 24
            }
          )
        ] }, row.path)) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dshRewind-dialogNote", "data-tone": unrestorable.length > 0 ? "warn" : "plain", children: unrestorable.length > 0 ? t("rewind.confirm.unrestorable", { n: unrestorable.length }) : t("rewind.confirm.note") })
      ]
    }
  );
}

// src/client/hide-turns.ts
var import_react2 = require("react");
var HIDE_STYLE_ID = "dsh-rewind-plugin-hide";
function hideCss(turns) {
  return turns.filter((turn) => Number.isSafeInteger(turn) && turn >= 0).map((turn) => `[data-chat-turn="${turn}"]{display:none !important}`).join("\n");
}
function useHiddenTurns(turns) {
  const css = (0, import_react2.useMemo)(() => hideCss(turns ?? []), [turns]);
  (0, import_react2.useEffect)(() => {
    if (typeof document === "undefined") return void 0;
    let el = document.querySelector(`style[data-plugin-css=${JSON.stringify(HIDE_STYLE_ID)}]`);
    if (el === null) {
      el = document.createElement("style");
      el.dataset.plugin = "dsh-rewind-plugin";
      el.dataset.pluginCss = HIDE_STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = css;
    return void 0;
  }, [css]);
}

// src/client/recall-note-host.tsx
var import_react3 = require("react");
var import_client = require("react-dom/client");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/recall-note.ts
var NOTE_HOLD_MS = 8e3;
var COMPOSER_CARD_SELECTOR = "div[data-composer-card]";
function noteAnchor() {
  if (typeof document === "undefined") return null;
  const found = document.querySelector(COMPOSER_CARD_SELECTOR);
  return found instanceof HTMLElement ? found : null;
}

// src/client/recall-note-host.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var current;
var seq = 0;
var listeners = /* @__PURE__ */ new Set();
function subscribe(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function showRecallNote(text, tone = "error") {
  if (text === "") return;
  console.warn(`[plugin-rewind] ${text}`);
  seq += 1;
  current = { text, tone, seq };
  for (const listener of listeners) listener();
}
function mountRecallNoteHost() {
  if (typeof document === "undefined") return () => {
  };
  const container = document.createElement("div");
  container.dataset.plugin = "dsh-rewind-plugin";
  document.body.appendChild(container);
  const root = (0, import_client.createRoot)(container);
  root.render(/* @__PURE__ */ (0, import_jsx_runtime2.jsx)(RecallNoteHost, {}));
  return () => {
    root.unmount();
    container.remove();
  };
}
function clearNote(shown) {
  if (current?.seq !== shown) return;
  current = void 0;
  for (const listener of listeners) listener();
}
function RecallNoteHost() {
  const [note, setNote] = (0, import_react3.useState)(current);
  (0, import_react3.useEffect)(() => {
    setNote(current);
    return subscribe(() => {
      setNote(current);
    });
  }, []);
  if (note === void 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    import_dsh_client_ui_primitives2.Toast,
    {
      text: note.text,
      ...note.tone === "success" ? { tone: "success" } : { icon: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.IconWarningOutlineRegular, {}) },
      holdMs: NOTE_HOLD_MS,
      anchor: noteAnchor(),
      onDone: () => {
        clearNote(note.seq);
      }
    },
    note.seq
  );
}

// src/client/message-action.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function RecallIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "svg",
    {
      viewBox: "0 0 16 16",
      width: "15",
      height: "15",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.4",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      focusable: "false",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M3.2 6.4h5.6a3.4 3.4 0 0 1 0 6.8H5.4" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M5.8 3.6 3 6.4l2.8 2.8" })
      ]
    }
  );
}
function findBuiltin(slots, key) {
  const entries = slots.entries("conversation.chat.node");
  const match = entries.find((entry) => entry.options?.key === key && (entry.options?.priority ?? 0) === 0) ?? entries.find((entry) => entry.options?.key === key);
  return match?.component;
}
function makeMessageActionView(key, deps) {
  function useBuiltin() {
    const [builtin, setBuiltin] = (0, import_react4.useState)(() => findBuiltin(deps.slots, key));
    (0, import_react4.useEffect)(() => {
      if (builtin !== void 0 && builtin !== null) return void 0;
      let cancelled = false;
      const timer = setInterval(() => {
        const found = findBuiltin(deps.slots, key);
        if (found === void 0 || found === null || cancelled) return;
        setBuiltin(found);
        clearInterval(timer);
      }, 250);
      return () => {
        cancelled = true;
        clearInterval(timer);
      };
    }, [builtin]);
    return builtin;
  }
  return function MessageActionView(props) {
    const builtin = useBuiltin();
    const sessionId = props.sessionId;
    const useProjection = props.useProjection;
    const [pending, setPending] = (0, import_react4.useState)(void 0);
    const [busy, setBusy] = (0, import_react4.useState)(false);
    const view = typeof useProjection === "function" ? useProjection("rewindAnchors") : void 0;
    useHiddenTurns(view?.hiddenTurns);
    if (builtin === void 0 || builtin === null) return null;
    const Builtin = builtin;
    const seq2 = typeof props.node?.anchorSeq === "number" ? props.node.anchorSeq : void 0;
    const anchor = seq2 === void 0 ? void 0 : view?.anchors?.find((item) => item.seq === seq2);
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Builtin, { ...props }),
      key === "user" && seq2 !== void 0 && anchor !== void 0 && typeof sessionId === "string" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dshRewind-iconRow", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Tooltip, { label: deps.t("rewind.message.action.hint"), side: "top", align: "end", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "button",
        {
          type: "button",
          className: "dshRewind-iconAction",
          "aria-label": deps.t("rewind.message.action.aria"),
          onClick: (event) => {
            event.stopPropagation();
            setBusy(true);
            void deps.plan(anchor.n, sessionId).then((planned) => {
              setBusy(false);
              if (planned.plan === void 0) {
                showRecallNote(planned.note ?? deps.t("rewind.error.unavailable"));
                return;
              }
              setPending({ n: anchor.n, sessionId, plan: planned.plan });
            });
          },
          children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(RecallIcon, {})
        }
      ) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        ConfirmDialog,
        {
          open: pending !== void 0,
          plan: pending?.plan,
          busy,
          t: deps.t,
          onClose: () => setPending(void 0),
          onConfirm: () => {
            const target = pending;
            if (target === void 0) return;
            setBusy(true);
            void deps.recall(target.n, target.sessionId).then((outcome) => {
              setBusy(false);
              setPending(void 0);
              if (outcome.note !== void 0) showRecallNote(outcome.note);
              else if (!outcome.ok) {
                showRecallNote(
                  outcome.code === void 0 ? deps.t("rewind.error.unavailable") : deps.t(outcome.code, outcome.params)
                );
              }
            });
          }
        }
      )
    ] });
  };
}

// src/client/locales.ts
var NS = "dsh-rewind";
var zh = {
  "rewind.message.action.aria": "\u64A4\u56DE\u8FD9\u6761\u6D88\u606F",
  "rewind.message.action.hint": "\u64A4\u56DE\u8FD9\u6761\u6D88\u606F",
  "rewind.host.busy": "\u5F53\u524D\u56DE\u5408\u8FD8\u6CA1\u7ED3\u675F\uFF0C\u7B49\u5B83\u8DD1\u5B8C\u518D\u64A4\u56DE\u3002",
  "rewind.host.badArg": "\u53C2\u6570\u53EA\u80FD\u662F\u7F16\u53F7\uFF0C\u4F8B\u5982 /rewind 2\uFF1B\u7559\u7A7A\u5219\u5217\u51FA\u53EF\u64A4\u56DE\u7684\u6D88\u606F\u3002",
  "rewind.host.outOfRange": "\u53EA\u6709 {available} \u6761\u53EF\u64A4\u56DE\u7684\u6D88\u606F\uFF0C\u6CA1\u6709\u7B2C {requested} \u6761\u3002",
  "rewind.host.empty": "\u8FD8\u6CA1\u6709\u53EF\u64A4\u56DE\u7684\u6D88\u606F\u3002",
  "rewind.host.notUserMessage": "\u8FD9\u6761\u6D88\u606F\u4E0D\u80FD\u4F5C\u4E3A\u64A4\u56DE\u70B9\u3002",
  "rewind.host.rejected": "\u64A4\u56DE\u88AB\u5185\u6838\u62D2\u7EDD\u4E86\uFF1A{detail}",
  "rewind.host.list": "\u5171\u6709 {count} \u6761\u53EF\u64A4\u56DE\u7684\u6D88\u606F\u3002",
  "rewind.host.done": "\u5DF2\u64A4\u56DE\u7B2C {n} \u6761\u6D88\u606F\uFF0C\u539F\u6587\u5DF2\u56DE\u5230\u8F93\u5165\u6846\u3002",
  "rewind.host.plan": "\u8FD9\u662F\u64A4\u56DE\u9884\u89C8\u3002",
  "rewind.error.unavailable": "\u64A4\u56DE\u529F\u80FD\u5F53\u524D\u4E0D\u53EF\u7528\uFF08\u7F3A\u5C11\u5FC5\u8981\u7684\u5185\u6838\u80FD\u529B\uFF09\u3002",
  "rewind.error.transport": "\u64A4\u56DE\u8BF7\u6C42\u6CA1\u80FD\u9001\u5230\u5185\u6838\uFF1A{detail}",
  "rewind.error.noSession": "\u5148\u6253\u5F00\u4E00\u4E2A\u4F1A\u8BDD\u3002",
  "rewind.files.unrestorable": "{count} \u4E2A\u6587\u4EF6\u65E0\u6CD5\u6062\u590D\uFF08\u4E0D\u5728\u64A4\u56DE\u8986\u76D6\u8303\u56F4\u5185\uFF09\uFF1A{paths}",
  "rewind.confirm.title": "\u786E\u8BA4\u64A4\u56DE",
  "rewind.confirm.nofiles": "\u8FD9\u6B21\u64A4\u56DE\u4E0D\u4F1A\u6539\u52A8\u4EFB\u4F55\u6587\u4EF6\u3002",
  "rewind.confirm.summary": "\u8FD9\u6B21\u64A4\u56DE\u4F1A\u6539\u52A8 {files} \u4E2A\u6587\u4EF6\u3002",
  "rewind.confirm.restore": "\u6062\u590D",
  "rewind.confirm.remove": "\u79FB\u8D70",
  "rewind.confirm.unrestorable": "{n} \u4E2A\u6587\u4EF6\u65E0\u6CD5\u6062\u590D\uFF08\u4E0D\u5728\u64A4\u56DE\u8986\u76D6\u8303\u56F4\u5185\uFF09",
  "rewind.confirm.showDiff": "\u67E5\u770B\u5DEE\u5F02",
  "rewind.confirm.hideDiff": "\u6536\u8D77\u5DEE\u5F02",
  "rewind.confirm.cancel": "\u53D6\u6D88",
  "rewind.confirm.confirm": "\u786E\u8BA4\u64A4\u56DE",
  "rewind.confirm.working": "\u6B63\u5728\u64A4\u56DE\u2026",
  "rewind.confirm.note": "\u88AB\u79FB\u8D70\u7684\u6587\u4EF6\u4F1A\u5B58\u8FDB\u9694\u79BB\u533A\uFF0C\u4E0D\u4F1A\u5220\u9664\u3002",
  "rewind.diff.copy": "\u590D\u5236",
  "rewind.diff.copied": "\u5DF2\u590D\u5236",
  "rewind.diff.wrap": "\u81EA\u52A8\u6362\u884C",
  "rewind.diff.unwrap": "\u53D6\u6D88\u6362\u884C",
  "rewind.diff.collapse": "\u6536\u8D77",
  "rewind.diff.expand": "\u5C55\u5F00\u5176\u4F59 {count} \u884C",
  "rewind.diff.collapseAria": "\u6536\u8D77\u5DEE\u5F02",
  "rewind.diff.expandAria": "\u5C55\u5F00\u5176\u4F59 {count} \u884C",
  "rewind.quarantine.title": "\u64A4\u56DE\u9694\u79BB\u533A",
  "rewind.quarantine.empty": "\u9694\u79BB\u533A\u662F\u7A7A\u7684\u3002\u64A4\u56DE\u65F6\u88AB\u79FB\u8D70\u7684\u6587\u4EF6\u4F1A\u4FDD\u5B58\u5230\u8FD9\u91CC\u3002",
  "rewind.quarantine.intro": "\u8FD9\u91CC\u4FDD\u5B58\u7740 {count} \u4EFD\u88AB\u79FB\u8D70\u7684\u5185\u5BB9\uFF0C\u5171 {size}\u3002\u64A4\u56DE\u672C\u8EAB\u662F\u53EF\u64A4\u9500\u7684\uFF0C\u9760\u7684\u5C31\u662F\u8FD9\u4E9B\u526F\u672C\uFF1B\u786E\u8BA4\u4E0D\u518D\u9700\u8981\u65F6\u53EF\u4EE5\u5728\u8FD9\u91CC\u6E05\u6389\u3002",
  "rewind.quarantine.kindCreated": "\u65B0\u5EFA",
  "rewind.quarantine.kindReplaced": "\u88AB\u66FF\u6362",
  "rewind.quarantine.kindUnknown": "\u672A\u77E5\u6765\u6E90",
  "rewind.quarantine.discard": "\u5220\u9664",
  "rewind.quarantine.discardAll": "\u6E05\u7A7A\u6B64\u4F1A\u8BDD",
  "rewind.quarantine.targetFile": "\u6587\u4EF6 {path} \u7684\u9694\u79BB\u526F\u672C",
  "rewind.quarantine.targetSlot": "\u9694\u79BB\u9879 {slot}",
  "rewind.quarantine.targetSession": "\u4F1A\u8BDD {session} \u7684\u5168\u90E8 {count} \u9879",
  "rewind.quarantine.confirmTitle": "\u5220\u9664\u9694\u79BB\u5185\u5BB9",
  "rewind.quarantine.confirmBody": "\u5C06\u6C38\u4E45\u5220\u9664{label}\uFF08{size}\uFF09\u3002",
  "rewind.quarantine.confirmWarn": "\u8FD9\u662F\u552F\u4E00\u7684\u4E00\u4EFD\u3002\u5220\u9664\u540E\uFF0C\u8FD9\u6B21\u64A4\u56DE\u5C31\u65E0\u6CD5\u518D\u64A4\u9500\u4E86\u2014\u2014\u64A4\u56DE\u524D\u7684\u6587\u4EF6\u5185\u5BB9\u5C06\u5F7B\u5E95\u4E22\u5931\u3002",
  "rewind.quarantine.confirm": "\u5220\u9664",
  "rewind.quarantine.cancel": "\u53D6\u6D88",
  "rewind.quarantine.purged": "\u5DF2\u5220\u9664 {count} \u9879\u3002",
  "rewind.quarantine.purgedPartial": "\u5DF2\u5220\u9664 {count} \u9879\uFF0C{failed} \u9879\u5220\u9664\u5931\u8D25\u3002",
  "rewind.route.listFailed": "\u8BFB\u53D6\u9694\u79BB\u533A\u5931\u8D25\uFF1A{detail}",
  "rewind.route.badBody": "\u8BF7\u6C42\u683C\u5F0F\u4E0D\u6B63\u786E\uFF08\u5FC5\u987B\u662F\u5927\u5C0F\u9650\u5236\u5185\u7684 JSON\uFF09\u3002",
  "rewind.route.targetsRequired": "\u8BF7\u6C42\u9700\u8981 targets \u6570\u7EC4\uFF08\u6BCF\u9879\u542B sessionId \u4E0E slot\uFF09\uFF0C\u6216 all: true\u3002",
  "rewind.route.tooMany": "\u4E00\u6B21\u6700\u591A\u5220\u9664 {max} \u9879\uFF0C\u8BF7\u5206\u6279\u64CD\u4F5C\u3002",
  "rewind.route.purgeFailed": "\u5220\u9664\u9694\u79BB\u5185\u5BB9\u5931\u8D25\uFF1A{detail}"
};
var en = {
  "rewind.message.action.aria": "Recall this message",
  "rewind.message.action.hint": "Recall this message",
  "rewind.host.busy": "The current turn is still running; recall after it finishes.",
  "rewind.host.badArg": "The argument must be an ordinal, e.g. /rewind 2; leave it empty to list recallable messages.",
  "rewind.host.outOfRange": "Only {available} recallable messages; there is no number {requested}.",
  "rewind.host.empty": "No recallable messages yet.",
  "rewind.host.notUserMessage": "That message cannot be a recall point.",
  "rewind.host.rejected": "The kernel refused the recall: {detail}",
  "rewind.host.list": "{count} recallable messages.",
  "rewind.host.done": "Recalled message {n}; its text is back in the composer.",
  "rewind.host.plan": "This is a recall preview.",
  "rewind.error.unavailable": "Recall is unavailable right now (a required kernel capability is missing).",
  "rewind.error.transport": "The recall request never reached the kernel: {detail}",
  "rewind.error.noSession": "Open a session first.",
  "rewind.files.unrestorable": "{count} file(s) could NOT be restored (outside what a recall can see): {paths}",
  "rewind.confirm.title": "Confirm recall",
  "rewind.confirm.nofiles": "This recall will not change any files.",
  "rewind.confirm.summary": "This recall will change {files} file(s).",
  "rewind.confirm.restore": "Restore",
  "rewind.confirm.remove": "Move away",
  "rewind.confirm.unrestorable": "{n} file(s) cannot be restored (outside what a recall can see)",
  "rewind.confirm.showDiff": "View diff",
  "rewind.confirm.hideDiff": "Hide diff",
  "rewind.confirm.cancel": "Cancel",
  "rewind.confirm.confirm": "Recall",
  "rewind.confirm.working": "Recalling\u2026",
  "rewind.confirm.note": "Moved files are kept in the quarantine, never deleted.",
  "rewind.diff.copy": "Copy",
  "rewind.diff.copied": "Copied",
  "rewind.diff.wrap": "Wrap lines",
  "rewind.diff.unwrap": "Unwrap lines",
  "rewind.diff.collapse": "Collapse",
  "rewind.diff.expand": "Show {count} more line(s)",
  "rewind.diff.collapseAria": "Collapse diff",
  "rewind.diff.expandAria": "Show the remaining {count} line(s)",
  "rewind.quarantine.title": "Recall quarantine",
  "rewind.quarantine.empty": "The quarantine is empty. Files a recall moves aside are kept here.",
  "rewind.quarantine.intro": "{count} displaced item(s) are kept here, {size} in total. These copies are what make a recall reversible; discard them here once you are sure you no longer need them.",
  "rewind.quarantine.kindCreated": "Created",
  "rewind.quarantine.kindReplaced": "Replaced",
  "rewind.quarantine.kindUnknown": "Unknown origin",
  "rewind.quarantine.discard": "Delete",
  "rewind.quarantine.discardAll": "Clear this session",
  "rewind.quarantine.targetFile": "the quarantine copy of {path}",
  "rewind.quarantine.targetSlot": "quarantine item {slot}",
  "rewind.quarantine.targetSession": "all {count} item(s) of session {session}",
  "rewind.quarantine.confirmTitle": "Delete quarantined content",
  "rewind.quarantine.confirmBody": "This permanently deletes {label} ({size}).",
  "rewind.quarantine.confirmWarn": "This is the only copy. Once it is gone this recall can no longer be undone \u2014 the file content from before the recall is lost for good.",
  "rewind.quarantine.confirm": "Delete",
  "rewind.quarantine.cancel": "Cancel",
  "rewind.quarantine.purged": "Deleted {count} item(s).",
  "rewind.quarantine.purgedPartial": "Deleted {count} item(s); {failed} could not be deleted.",
  "rewind.route.listFailed": "Could not read the quarantine: {detail}",
  "rewind.route.badBody": "The request was malformed (JSON, within the size limit).",
  "rewind.route.targetsRequired": "The request needs a targets array of { sessionId, slot }, or all: true.",
  "rewind.route.tooMany": "At most {max} items at a time; purge in batches.",
  "rewind.route.purgeFailed": "Could not purge the quarantine: {detail}"
};

// src/client/messages.ts
var KNOWN_KEYS = new Set(Object.keys(zh));
function asHostText(value) {
  if (typeof value !== "object" || value === null) return void 0;
  const record = value;
  return typeof record.code === "string" ? record : void 0;
}
function isKnownKey(code) {
  return KNOWN_KEYS.has(code);
}
function hostCode(raw) {
  if (raw === void 0 || raw === "") return void 0;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { code: UNKNOWN_CODE, params: { detail: raw } };
  }
  const payload = asHostText(parsed);
  if (payload === void 0) return { code: UNKNOWN_CODE, params: { detail: raw } };
  const code = payload.code;
  if (!isKnownKey(code)) {
    return {
      code: UNKNOWN_CODE,
      params: { detail: typeof payload.text === "string" && payload.text !== "" ? payload.text : code }
    };
  }
  const params = plainParams(payload.params);
  return params === void 0 ? { code } : { code, params };
}
var UNKNOWN_CODE = "rewind.host.rejected";
function plainParams(raw) {
  if (typeof raw !== "object" || raw === null) return void 0;
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" || typeof value === "number") out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : void 0;
}
function hostMessage(raw, t) {
  if (raw === void 0 || raw === "") return void 0;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return raw;
  }
  const payload = asHostText(parsed);
  if (payload === void 0) return raw;
  const code = payload.code;
  if (!isKnownKey(code)) {
    return typeof payload.text === "string" && payload.text !== "" ? payload.text : raw;
  }
  const params = resolveParams(payload.params, t);
  return t(code, params);
}
function resolveParams(raw, t) {
  if (typeof raw !== "object" || raw === null) return void 0;
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      out[key] = isKnownKey(value) ? t(value) : value;
    } else if (typeof value === "number") {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : void 0;
}

// src/client/command-row.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function RewindCommandRow({ node, t }) {
  const command = node;
  const outcome = command.outcome;
  const raw = outcome?.text;
  const rendered = hostMessage(raw, t);
  const failed = outcome?.kind === "error";
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dshRewind-commandRow", "data-tone": failed ? "error" : "info", role: "status", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dshRewind-commandText", children: rendered ?? "" }) });
}

// src/client/popup.ts
function clockOf(time) {
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
function anchorsToOptions(view) {
  const anchors = view?.anchors ?? [];
  return anchors.map((anchor) => {
    const time = clockOf(anchor.time);
    return {
      id: String(anchor.n),
      label: anchor.preview === "" ? String(anchor.seq) : anchor.preview,
      ...time === "" ? {} : { detail: time }
    };
  });
}

// src/client/quarantine-section.tsx
var import_react5 = require("react");
var import_dsh_client_ui_primitives4 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime5 = require("react/jsx-runtime");
var ROUTE = "/api/plugins/dsh-rewind-plugin/quarantine";
var HostError = class extends Error {
  host;
  constructor(host, message) {
    super(message);
    this.host = host;
  }
};
async function fetchJson(url, init) {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  const body = await response.json();
  if (!response.ok || body.ok !== true) {
    throw new HostError(body.error?.host, body.error?.message ?? `HTTP ${response.status}`);
  }
  return body.value;
}
function failureText(error, t) {
  if (error instanceof HostError) {
    const code = error.host?.code;
    if (code !== void 0 && KNOWN_KEYS2.has(code)) {
      return t(code, error.host?.params);
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}
var KNOWN_KEYS2 = new Set(Object.keys(zh));
function sizeText(bytes) {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function baseName2(path) {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? path;
}
function clockText(at) {
  if (at === void 0) return "";
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function QuarantineSection({ t }) {
  const [listing, setListing] = (0, import_react5.useState)(null);
  const [failure, setFailure] = (0, import_react5.useState)(null);
  const [busy, setBusy] = (0, import_react5.useState)(false);
  const [pending, setPending] = (0, import_react5.useState)(void 0);
  const [notice, setNotice] = (0, import_react5.useState)(null);
  const load = (0, import_react5.useCallback)(async () => {
    try {
      setListing(await fetchJson(ROUTE));
      setFailure(null);
    } catch (error) {
      setFailure(failureText(error, t));
    }
  }, [t]);
  (0, import_react5.useEffect)(() => {
    void load();
  }, [load]);
  const onPurge = (0, import_react5.useCallback)((targets, bytes, label) => {
    setNotice(null);
    setPending({ targets, bytes, label });
  }, []);
  const onConfirm = (0, import_react5.useCallback)(async () => {
    const target = pending;
    if (target === void 0) return;
    setBusy(true);
    try {
      const result = await fetchJson(`${ROUTE}/purge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets: target.targets })
      });
      setNotice(result.failed.length === 0 ? t("rewind.quarantine.purged", { count: result.removed }) : t("rewind.quarantine.purgedPartial", { count: result.removed, failed: result.failed.length }));
      setPending(void 0);
      await load();
    } catch (error) {
      setFailure(failureText(error, t));
    } finally {
      setBusy(false);
    }
  }, [pending, t, load]);
  const groups = listing?.groups ?? [];
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dshRewind-quarantine", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h2", { className: "dshRewind-quarantineTitle", children: t("rewind.quarantine.title") }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "dshRewind-quarantineIntro", children: listing === null || listing.entries === 0 ? t("rewind.quarantine.empty") : t("rewind.quarantine.intro", {
      count: listing.entries,
      size: sizeText(listing.bytes)
    }) }),
    failure !== null && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "dshRewind-quarantineError", role: "status", children: failure }),
    notice !== null && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "dshRewind-quarantineNotice", role: "status", children: notice }),
    groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { className: "dshRewind-quarantineGroup", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("header", { className: "dshRewind-quarantineHead", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dshRewind-quarantineSession", title: group.sessionId, children: group.sessionId }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dshRewind-quarantineMeta", children: sizeText(group.bytes) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          import_dsh_client_ui_primitives4.Button,
          {
            variant: "outline",
            size: "sm",
            disabled: busy,
            onClick: () => onPurge(
              group.entries.map((entry) => ({ sessionId: group.sessionId, slot: entry.slot })),
              group.bytes,
              t("rewind.quarantine.targetSession", { session: group.sessionId, count: group.entries.length })
            ),
            children: t("rewind.quarantine.discardAll")
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("ul", { className: "dshRewind-quarantineList", children: group.entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("li", { className: "dshRewind-quarantineRow", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dshRewind-quarantineRowMain", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dshRewind-quarantineKind", "data-kind": entry.kind, children: entry.kind === "created" ? t("rewind.quarantine.kindCreated") : entry.kind === "replaced" ? t("rewind.quarantine.kindReplaced") : t("rewind.quarantine.kindUnknown") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dshRewind-quarantinePath", title: entry.originalPath ?? "", children: entry.originalPath === void 0 ? entry.slot : baseName2(entry.originalPath) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dshRewind-quarantineMeta", children: clockText(entry.at) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dshRewind-quarantineMeta", children: sizeText(entry.bytes) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          import_dsh_client_ui_primitives4.Button,
          {
            variant: "ghost",
            size: "sm",
            disabled: busy,
            onClick: () => onPurge(
              [{ sessionId: entry.sessionId, slot: entry.slot }],
              entry.bytes,
              entry.originalPath === void 0 ? t("rewind.quarantine.targetSlot", { slot: entry.slot }) : t("rewind.quarantine.targetFile", { path: baseName2(entry.originalPath) })
            ),
            children: t("rewind.quarantine.discard")
          }
        )
      ] }, entry.slot)) })
    ] }, group.sessionId)),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      import_dsh_client_ui_primitives4.Modal,
      {
        open: pending !== void 0,
        onClose: () => setPending(void 0),
        title: t("rewind.quarantine.confirmTitle"),
        closeLabel: t("rewind.quarantine.cancel"),
        description: pending === void 0 ? "" : t("rewind.quarantine.confirmBody", {
          label: pending.label,
          size: sizeText(pending.bytes)
        }),
        footer: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_dsh_client_ui_primitives4.Button, { variant: "outline", disabled: busy, onClick: () => setPending(void 0), children: t("rewind.quarantine.cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_dsh_client_ui_primitives4.Button, { variant: "primary", disabled: busy, onClick: () => {
            void onConfirm();
          }, children: t("rewind.quarantine.confirm") })
        ] }),
        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "dshRewind-quarantineWarn", children: t("rewind.quarantine.confirmWarn") })
      }
    )
  ] });
}

// src/client/styles.ts
var STYLE_ID = "dsh-rewind-plugin-style";
var cssText = `
.dshRewind-iconRow {
  /*
   * The icon joins the built-in actions line rather than stacking a second row
   * under it.
   *
   * The built-in user bubble ends with its own actions row (the time label plus
   * the copy button), and that row is not addressable by name \u2014 its classes are
   * build-hashed. So the icon is absolutely positioned into the free space at
   * the row's right end, and the actions row is shifted left by the icon's
   * footprint to make that space (see the [data-clock] rule below).
   */
  position: absolute;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  opacity: 0;
  transition: opacity 80ms;
}
.dshRewind-iconAction {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: var(--dsw-radius-sm);
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
}
/*
 * The reveal keys off the CHAT FLOW ITEM, not this row.
 *
 * This row is absolutely positioned over the message block, so a rule on the
 * row's own :hover would only fire once the pointer had already left the
 * bubble \u2014 the user hovers the message, which is the whole point. The flow item
 * wraps the bubble and this row, so hovering anywhere in the message reveals
 * the icon: the same mechanism the built-in message actions use.
 */
[data-chat-flow-kind="user"]:hover .dshRewind-iconRow,
[data-chat-flow-kind="steering"]:hover .dshRewind-iconRow,
.dshRewind-iconRow:focus-within {
  opacity: 1;
}
.dshRewind-iconAction:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-secondary);
}
.dshRewind-iconAction:focus-visible {
  /* The shipped settings tabs write their focus ring exactly this way, fallback
     token included, so this control's ring matches every other one on the page. */
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
}
/* The containing block for the absolutely positioned icon row. */
[data-chat-flow-kind="user"],
[data-chat-flow-kind="steering"] {
  position: relative;
}
/*
 * Make room for the icon at the right end of the built-in actions line.
 *
 * data-clock is the stable semantic attribute the kernel's own
 * MessageIconActions emits on that row (a user message renders it with
 * data-clock="start"); its class names are build-hashed and unusable as a
 * selector. The row is a flex container, so a right margin moves the icon's
 * space to the far right without disturbing the time/copy order.
 */
[data-chat-flow-kind="user"] [data-clock="start"] {
  margin-right: 32px;
}
@media (hover: none) {
  /* A touch device has no hover, so the icon must always be reachable. */
  .dshRewind-iconRow {
    opacity: 1;
  }
}
/*
 * The confirmation dialog's CONTENT only.
 *
 * The frame \u2014 mask, card, elevation, title, close affordance, footer buttons \u2014
 * comes from the host's own Modal and Button components (confirm-dialog.tsx), so
 * these rules style just the file list inside it. Redrawing the frame here is what
 * made an earlier version look wrong in both themes.
 *
 * The one exception is the CARD WIDTH, set through the primitive's own
 * className seat: its 380px default suits a sentence and wraps a code line three
 * times in a diff. A wider card is a content requirement, and overriding it
 * through the documented hook is not redrawing the frame.
 *
 * The selector is doubled on purpose. The primitive's own dialog class is a
 * single class too, so an equal-specificity rule would win or lose by whichever
 * stylesheet the document happened to load last \u2014 a race, not a decision.
 * Doubling makes the override order-independent.
 */
.dshRewind-confirmDialog.dshRewind-confirmDialog {
  width: min(880px, 100%);
}
.dshRewind-fileList {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
}
.dshRewind-fileRow {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 8px;
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-layer-1);
}
.dshRewind-fileHead {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.dshRewind-fileAction {
  flex: none;
  padding: 0 6px;
  border-radius: var(--dsw-radius-xs);
  font-size: 11px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-interactive-bg-hover);
}
.dshRewind-fileAction[data-action="restore"] {
  color: var(--dsw-alias-state-warn-primary);
}
.dshRewind-fileAction[data-action="remove"] {
  color: var(--dsw-alias-state-error-primary);
}
.dshRewind-filePath {
  flex: auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--dsw-alias-label-primary);
}


/*
 * The one sentence a user must not miss: what this recall CANNOT put back. It
 * stays visible even at zero, so silence never reads as "nothing else changed".
 */
.dshRewind-dialogNote {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.dshRewind-dialogNote[data-tone="warn"] {
  color: var(--dsw-alias-state-warn-primary);
}
/*
 * The quarantine manager (its own page in Settings).
 *
 * Content only, like the confirm dialog: the frame is the settings shell's. The
 * colours are alias tokens so both themes stay legible, and the size figures use
 * tabular numerals so a column of them lines up.
 */
.dshRewind-quarantine {
  display: flex;
  flex-direction: column;
  gap: 12px;
  /* The shipped settings pages cap their column at 760px and set the primary
     label colour on the wrapper; matching them keeps this page's measure and
     text colour identical to General / Models / Plugins. */
  max-width: 760px;
  color: var(--dsw-alias-label-primary);
}
.dshRewind-quarantineTitle {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
.dshRewind-quarantineIntro {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
}
.dshRewind-quarantineError {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-state-error-primary);
}
.dshRewind-quarantineNotice {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
}
.dshRewind-quarantineGroup {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dshRewind-quarantineHead {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 4px 0;
}
.dshRewind-quarantineSession {
  flex: auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}
.dshRewind-quarantineMeta {
  flex: none;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
  font-variant-numeric: tabular-nums;
}
.dshRewind-quarantineList {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.dshRewind-quarantineRow {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 4px 8px;
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-layer-1);
}
.dshRewind-quarantineRowMain {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: auto;
}
.dshRewind-quarantineKind {
  flex: none;
  padding: 0 6px;
  border-radius: var(--dsw-radius-xs);
  font-size: 11px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-interactive-bg-hover);
}
.dshRewind-quarantineKind[data-kind="created"] {
  color: var(--dsw-alias-state-warn-primary);
}
.dshRewind-quarantinePath {
  flex: auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--dsw-alias-label-primary);
}
.dshRewind-quarantineWarn {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-state-error-primary);
}
.dshRewind-commandRow {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
}
.dshRewind-commandRow[data-tone="error"] {
  color: var(--dsw-alias-state-error-primary);
}
.dshRewind-commandText {
  min-width: 0;
}
`;
function adoptStyles() {
  if (typeof document === "undefined") return;
  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_ID)}]`) !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-rewind-plugin";
  tag.dataset.pluginCss = STYLE_ID;
  tag.textContent = cssText;
  document.head.appendChild(tag);
}

// src/wire.ts
var REWIND_PROJECTION_KEY = "rewindAnchors";
var REWIND_COMMAND = "rewind";

// src/client.ts
var inject = ["slots", "locale", "sessions", "uiSession", "remote", "remote.commands"];
var CHAT_NS = "chat";
var RECALL_DONE_CODE = "rewind.host.done";
var QUARANTINE_SECTION_ID = "dsh-rewind-quarantine";
function apply(ctx) {
  const handled = /* @__PURE__ */ new Set();
  ctx.effect(
    () => ctx.locale.register(NS, { zh, en }),
    "dsh-rewind-plugin: dictionaries"
  );
  adoptStyles();
  ctx.effect(() => mountRecallNoteHost(), "plugin-rewind: recall note host");
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: QUARANTINE_SECTION_ID,
    // Past the shipped pages (account -10 … plugins 15) and the feature pages a
    // suite adds (…about 26), before the market's rails (40, 300): a maintenance
    // page for one plugin belongs at the tail of the feature pages.
    order: 30,
    // `locale:` puts the namespace-bound `t` seat on the component's props.
    locale: NS,
    label: () => t("rewind.quarantine.title")
  }, QuarantineSection));
  ctx.slots.inject("conversation.chat.commandview", () => ctx.slots.register({
    name: "conversation.chat.commandview",
    key: REWIND_COMMAND,
    locale: NS
  }, RewindCommandRow));
  ctx.inject(["commandUi"], (scope) => {
    const commandUi = scope.get("commandUi");
    if (commandUi === void 0) return;
    scope.effect(() => commandUi.decorate({
      name: REWIND_COMMAND,
      available: (session) => readProjection(ctx, session.sessionId) !== void 0,
      ui: {
        kind: "popupSelect",
        options: async (session) => anchorsToOptions(readProjection(ctx, session.sessionId)),
        onSelect: async (option, session) => {
          const n = Number(option.id);
          if (!Number.isSafeInteger(n) || n < 1) return;
          await recallByOrdinal(ctx, t, n, session.sessionId, handled);
        }
      }
    }), "dsh-rewind-plugin: /rewind popup");
  });
  const t = ctx.locale.bind(NS);
  const deps = {
    slots: ctx.slots,
    t,
    recall: (ordinal, sessionId) => recallByOrdinal(ctx, t, ordinal, sessionId, handled),
    plan: (ordinal, sessionId) => planRecall(ctx, t, ordinal, sessionId)
  };
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
    name: "conversation.chat.node",
    key: "user",
    priority: -1,
    locale: CHAT_NS
  }, makeMessageActionView("user", deps)));
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
    name: "conversation.chat.node",
    key: "steering",
    priority: -1,
    locale: CHAT_NS
  }, makeMessageActionView("steering", deps)));
  observeTypedRecalls(ctx, handled);
}
function observeTypedRecalls(ctx, handled) {
  const sessions = ctx.get("sessions");
  if (sessions?.binding === void 0) return;
  const seen = /* @__PURE__ */ new Set();
  const watched = /* @__PURE__ */ new Set();
  const watch = (sessionId) => {
    if (watched.has(sessionId)) return;
    const source = sessions.binding?.(sessionId)?.eventSource;
    if (source === void 0) return;
    watched.add(sessionId);
    const stop = source.subscribe(() => {
      const change = source.getSnapshot().change;
      if (change?.kind !== "append") return;
      for (const entry of change.entries ?? []) {
        const event = entry.event;
        if (event?.type !== "command/done") continue;
        const key = `${sessionId}:${String(event.seq)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const data = event.data;
        if (data?.kind !== "success") continue;
        if (typeof data.text !== "string") continue;
        if (!data.text.includes(`"${RECALL_DONE_CODE}"`)) continue;
        if (typeof data.sourceEventSeq === "number" && handled.has(data.sourceEventSeq)) continue;
        prefillRecalled(ctx, sessionId, data.text);
      }
    });
    ctx.effect(() => stop, `plugin-rewind: typed-recall observer for ${sessionId}`);
  };
  const known = () => {
    const list2 = ctx.get("sessions")?.list?.getSnapshot?.();
    return [...list2?.ids ?? Object.keys(list2?.byId ?? {})];
  };
  for (const id of known()) watch(id);
  const list = ctx.get("sessions")?.list;
  if (list?.subscribe === void 0) return;
  const stopAll = list.subscribe(() => {
    for (const id of known()) watch(id);
  });
  ctx.effect(() => stopAll, "plugin-rewind: typed-recall observer list");
}
async function planRecall(ctx, t, n, sessionId) {
  const remote = ctx.get("remote")?.commands;
  if (remote === void 0) return { note: t("rewind.error.unavailable") };
  if (typeof sessionId !== "string" || sessionId === "") return { note: t("rewind.error.noSession") };
  try {
    const result = await remote.execute(sessionId, `/rewind plan ${n}`, []);
    const outcome = result.value?.result;
    if (!result.ok || outcome === void 0) return { note: transportNote(t, result.error) };
    if (outcome.kind !== "success") {
      const coded = hostCode(outcome.text);
      return { note: coded === void 0 ? t("rewind.error.unavailable") : t(coded.code, coded.params) };
    }
    const payload = parsedPlan(outcome.text);
    if (payload?.ok !== true) {
      const coded = hostCode(outcome.text);
      return { note: coded === void 0 ? t("rewind.error.unavailable") : t(coded.code, coded.params) };
    }
    return { plan: payload };
  } catch (error) {
    return { note: transportNote(t, error) };
  }
}
function parsedPlan(raw) {
  if (raw === void 0 || raw === "") return void 0;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return void 0;
    return parsed;
  } catch {
    return void 0;
  }
}
async function recallByOrdinal(ctx, t, n, sessionId, handled) {
  const remote = ctx.get("remote")?.commands;
  if (remote === void 0) return { ok: false, code: "rewind.error.unavailable" };
  const target = sessionId;
  if (typeof target !== "string" || target === "") return { ok: false, code: "rewind.error.noSession" };
  try {
    const result = await remote.execute(target, `/rewind ${n}`, []);
    const outcome = result.value?.result;
    if (!result.ok || outcome === void 0) return transportFailure(result.error);
    if (outcome.kind !== "success") {
      const coded = hostCode(outcome.text);
      return coded === void 0 ? { ok: false, code: "rewind.error.unavailable" } : { ok: false, code: coded.code, ...coded.params === void 0 ? {} : { params: coded.params } };
    }
    if (typeof outcome.sourceEventSeq === "number") handled.add(outcome.sourceEventSeq);
    const blocked = prefillRecalled(ctx, target, outcome.text);
    const revert = revertSummary(outcome.text, t);
    if (blocked !== void 0) return { ok: true, note: `composer prefill skipped: ${blocked}` };
    if (revert !== void 0) return { ok: true, note: revert };
    return { ok: true };
  } catch (error) {
    return transportFailure(error);
  }
}
function transportFailure(error) {
  const detail = transportDetail(error);
  return detail === void 0 ? { ok: false, code: "rewind.error.unavailable" } : { ok: false, code: "rewind.error.transport", params: { detail } };
}
function transportNote(t, error) {
  const detail = transportDetail(error);
  return detail === void 0 ? t("rewind.error.unavailable") : t("rewind.error.transport", { detail });
}
function transportDetail(error) {
  if (typeof error !== "object" || error === null) return void 0;
  const message = error.message;
  if (typeof message !== "string") return void 0;
  const trimmed = message.trim();
  return trimmed === "" ? void 0 : trimmed;
}
function revertSummary(raw, t) {
  if (raw === void 0 || raw === "") return void 0;
  let files;
  try {
    files = JSON.parse(raw).files;
  } catch {
    return void 0;
  }
  if (typeof files !== "object" || files === null) return void 0;
  const { unrestorable } = files;
  if (!Array.isArray(unrestorable) || unrestorable.length === 0) return void 0;
  const names = unrestorable.map((entry) => typeof entry === "object" && entry !== null ? entry.path : void 0).filter((p) => typeof p === "string");
  return t("rewind.files.unrestorable", {
    count: unrestorable.length,
    paths: names.join(", ")
  });
}
function prefillRecalled(ctx, sessionId, raw) {
  const prompt = recalledPrompt(raw);
  if (prompt === void 0 || prompt === "") return "no prompt in the command result";
  const sessions = ctx.get("sessions");
  const owner = sessions?.binding?.(sessionId);
  if (owner === void 0) return "this session resolved no raw binding";
  const materialized = materializedBinding(ctx, sessionId, owner);
  if (materialized === void 0) return "the uiSession binding is unavailable";
  const setDraft = materialized.props?.inputActions?.setDraft;
  if (typeof setDraft !== "function") return "the materialized binding publishes no inputActions.setDraft";
  const published = materialized.hooks?.input?.getSnapshot?.();
  const state = typeof published === "object" && published !== null ? published : void 0;
  const draft = typeof state?.draft === "string" ? state.draft : void 0;
  if (draft !== void 0 && draft === prompt) return void 0;
  if (draft !== void 0 && draft.trim() !== "") return "the composer already holds text";
  if (typeof state?.phase === "string" && state.phase !== "plain") {
    return deferUntilIdle(materialized, setDraft, prompt);
  }
  ;
  setDraft(prompt);
  return void 0;
}
var SETTLE_TIMEOUT_MS = 15e3;
function deferUntilIdle(binding, setDraft, prompt) {
  const input = binding.hooks?.input;
  if (typeof input?.subscribe !== "function" || typeof input.getSnapshot !== "function") {
    showRecallNote("composer prefill skipped: the composer state is not subscribable");
    return void 0;
  }
  const settle = () => {
    const state = input.getSnapshot?.();
    if (typeof state?.phase === "string" && state.phase !== "plain") return;
    stop();
    const draft = typeof state?.draft === "string" ? state.draft : void 0;
    if (draft === prompt) return;
    if (draft !== void 0 && draft.trim() !== "") {
      showRecallNote("composer prefill skipped: the composer already holds text");
      return;
    }
    setDraft(prompt);
  };
  let stopped = false;
  const unsubscribe = input.subscribe(settle);
  const timer = setTimeout(() => {
    stop();
    showRecallNote("composer prefill skipped: the composer never settled");
  }, SETTLE_TIMEOUT_MS);
  function stop() {
    if (stopped) return;
    stopped = true;
    unsubscribe();
    clearTimeout(timer);
  }
  return void 0;
}
function materializedBinding(ctx, sessionId, owner) {
  const uiSession = ctx.get("uiSession");
  try {
    const source = uiSession?.bindingSource?.({ sessionId, binding: owner });
    return source?.getSnapshot?.();
  } catch {
    return void 0;
  }
}
function recalledPrompt(raw) {
  if (raw === void 0 || raw === "") return void 0;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed?.prompt === "string" ? parsed.prompt : void 0;
  } catch {
    return void 0;
  }
}
function readProjection(ctx, sessionId) {
  const sessions = ctx.get("sessions");
  return sessions?.binding?.(sessionId)?.session?.projections?.faceOf?.(REWIND_PROJECTION_KEY)?.getSnapshot?.();
}

return module.exports;
} });
