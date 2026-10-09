// src/index.ts
import z2 from "@deepseek-ai/schemastery";
import { SessionSeq } from "@deepseek-ai/dsh-session";

// src/cut.ts
import { createUserMessage } from "@deepseek-ai/dsh-llm";

// src/wire.ts
var REWIND_PROJECTION_KEY = "rewindAnchors";
var REWIND_COMMAND = "rewind";
var REWIND_SOURCE_KIND = "dsh-rewind";
var MAX_ANCHORS = 50;
var PREVIEW_CHARS = 80;
function hostText(code, params, text) {
  return { code, ...params === void 0 ? {} : { params }, ...text === void 0 ? {} : { text } };
}
function previewText(raw, limit = PREVIEW_CHARS) {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  return collapsed.length > limit ? `${collapsed.slice(0, limit)}\u2026` : collapsed;
}

// src/cut.ts
function messageText(event) {
  const data = event.data;
  if (typeof data !== "object" || data === null) return "";
  const record = data;
  const content = Array.isArray(record.content) ? record.content : Array.isArray(record.message?.content) ? record.message.content : [];
  return content.filter((block) => typeof block === "object" && block !== null && block.type === "text" && typeof block.text === "string").map((block) => block.text).join("");
}
function isUserPrompt(event) {
  if (event.type !== "user/message") return false;
  const data = event.data;
  if (typeof data !== "object" || data === null) return false;
  const source = data.source;
  if (typeof source !== "object" || source === null) return false;
  return source.kind === "user";
}
function surfaceTurns(session) {
  const turns = /* @__PURE__ */ new Map();
  let open = null;
  const nodes = session.surface.nodes;
  const last = nodes.length === 0 ? -1 : nodes[nodes.length - 1];
  for (let seq = 0; seq <= last; seq += 1) {
    const event = session.eventAt(seq);
    if (event === void 0) continue;
    if (event.type === "turn/start") {
      const turn = event.data?.turn;
      if (typeof turn === "number" && Number.isSafeInteger(turn) && turn >= 0) open = turn;
      continue;
    }
    if (open !== null && nodes.includes(seq)) turns.set(seq, open);
  }
  return turns;
}
function listAnchors(session, max = MAX_ANCHORS) {
  const anchors = [];
  const nodes = session.surface.nodes;
  const turns = surfaceTurns(session);
  const openers = /* @__PURE__ */ new Set();
  const claimed = /* @__PURE__ */ new Set();
  for (const seq of nodes) {
    const event = session.eventAt(seq);
    if (event === void 0 || !isUserPrompt(event)) continue;
    const turn = turns.get(seq) ?? null;
    if (turn === null) {
      openers.add(seq);
      continue;
    }
    if (claimed.has(turn)) continue;
    claimed.add(turn);
    openers.add(seq);
  }
  for (let i = nodes.length - 1; i >= 0 && anchors.length < max; i -= 1) {
    const seq = nodes[i];
    if (!openers.has(seq)) continue;
    const event = session.eventAt(seq);
    if (event === void 0) continue;
    anchors.push({
      n: anchors.length + 1,
      seq,
      turn: turns.get(seq) ?? null,
      time: event.time,
      preview: previewText(messageText(event))
    });
  }
  return anchors;
}
function planCut(session, n, max = MAX_ANCHORS) {
  const anchors = listAnchors(session, max);
  if (anchors.length === 0) return { reason: "empty" };
  if (!Number.isSafeInteger(n) || n < 1 || n > anchors.length) {
    return { reason: "outOfRange", available: anchors.length };
  }
  const anchor = anchors[n - 1];
  const nodes = session.surface.nodes;
  const startIdx = nodes.indexOf(anchor.seq);
  if (startIdx === -1) return { reason: "notUserMessage" };
  const shadowedSeqs = nodes.slice(startIdx);
  if (shadowedSeqs.length === 0) return { reason: "notUserMessage" };
  const turns = [];
  const turnMap = surfaceTurns(session);
  for (const seq of shadowedSeqs) {
    const turn = turnMap.get(seq);
    if (turn !== void 0 && !turns.includes(turn)) turns.push(turn);
  }
  turns.sort((a, b) => a - b);
  return {
    startSeq: anchor.seq,
    endSeq: shadowedSeqs[shadowedSeqs.length - 1],
    shadowedSeqs,
    turns,
    prompt: messageText(session.eventAt(anchor.seq) ?? { seq: anchor.seq, time: 0, type: "", data: null }),
    turn: anchor.turn
  };
}
function placeholderData() {
  return createUserMessage({
    content: [],
    source: { kind: REWIND_SOURCE_KIND }
  });
}

// src/snapshots.ts
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
var MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024;
async function captureBefore(path) {
  try {
    const info = await stat(path);
    if (!info.isFile()) return { kind: "unreadable", reason: "not a regular file" };
    if (info.size > MAX_SNAPSHOT_BYTES) return { kind: "too-large" };
    return { kind: "captured", before: await readFile(path, "utf8") };
  } catch (error) {
    if (error.code === "ENOENT") return { kind: "captured", before: null };
    return { kind: "unreadable", reason: error instanceof Error ? error.message : String(error) };
  }
}
function quarantineBase(dshHome) {
  return join(dshHome, "storages", "dsh-rewind-plugin", "quarantine");
}
function quarantineRoot(dshHome, sessionId) {
  return join(quarantineBase(dshHome), sessionId);
}
function stamp(now) {
  return new Date(now).toISOString().replace(/[:.]/g, "-");
}
var MANIFEST_NAME = "manifest.json";
async function restoreOne(snapshot, quarantineDir, now) {
  const slot = join(quarantineDir, `${stamp(now)}-${Math.abs(hash(snapshot.path))}`);
  try {
    const current = await captureBefore(snapshot.path);
    if (current.kind === "unreadable") return { kind: "failed", reason: current.reason };
    if (current.kind === "too-large") {
      return { kind: "failed", reason: "the current file is too large to quarantine safely" };
    }
    const present = current.before;
    await mkdir(slot, { recursive: true });
    const writeManifest = (kind) => writeFile(
      join(slot, MANIFEST_NAME),
      JSON.stringify({ originalPath: snapshot.path, kind, at: now }),
      "utf8"
    );
    if (snapshot.before === null) {
      if (present === null) return { kind: "removed" };
      await writeFile(join(slot, "created"), present, "utf8");
      await writeManifest("created");
      await rm(snapshot.path, { force: true });
      return { kind: "removed", slot };
    }
    if (present !== null) {
      await writeFile(join(slot, "replaced"), present, "utf8");
      await writeManifest("replaced");
    }
    await mkdir(dirname(snapshot.path), { recursive: true });
    await writeFile(snapshot.path, snapshot.before, "utf8");
    return { kind: "restored", slot };
  } catch (error) {
    return { kind: "failed", reason: error instanceof Error ? error.message : String(error) };
  }
}
function hash(value) {
  let out = 0;
  for (let i = 0; i < value.length; i += 1) {
    out = out * 31 + value.charCodeAt(i) | 0;
  }
  return out;
}

// src/recorder.ts
function createRecorder(capture = captureBefore) {
  const changes = [];
  const failures = [];
  const seen = /* @__PURE__ */ new Set();
  return {
    recorder: {
      changesForTurns(turns) {
        const wanted = new Set(turns);
        return changes.filter((c) => c.turn !== null && wanted.has(c.turn));
      },
      failuresForTurns(turns) {
        const wanted = new Set(turns);
        return failures.filter((f) => f.turn !== null && wanted.has(f.turn));
      },
      forget(turns) {
        const wanted = new Set(turns);
        for (let i = changes.length - 1; i >= 0; i -= 1) {
          const turn = changes[i].turn;
          if (turn !== null && wanted.has(turn)) changes.splice(i, 1);
        }
        for (let i = failures.length - 1; i >= 0; i -= 1) {
          const turn = failures[i].turn;
          if (turn !== null && wanted.has(turn)) failures.splice(i, 1);
        }
      },
      size() {
        return changes.length;
      }
    },
    record(path, turn, seq) {
      const key = `${path}\0${String(seq)}`;
      if (seen.has(key)) return;
      seen.add(key);
      void capture(path).then((result) => {
        if (result.kind === "captured") {
          changes.push({ path, before: result.before, turn });
          return;
        }
        failures.push({
          path,
          turn,
          reason: result.kind === "too-large" ? "the file is too large to snapshot" : result.reason
        });
      });
    }
  };
}
function turnAt(events, seq) {
  let open = null;
  for (const event of events) {
    const at = typeof event.seq === "number" ? event.seq : -1;
    if (at > seq) break;
    if (event.type !== "turn/start") continue;
    const turn = event.data?.turn;
    if (typeof turn === "number" && Number.isSafeInteger(turn) && turn >= 0) open = turn;
  }
  return open;
}

// src/projection.ts
import { z } from "zod";
var nonNegInt = z.number().int().nonnegative();
var surfaceNodeSchema = z.object({
  seq: nonNegInt,
  time: nonNegInt,
  turn: nonNegInt.nullable(),
  prompt: z.boolean(),
  text: z.string()
});
var rewindStateSchema = z.object({
  nodes: z.array(surfaceNodeSchema),
  hiddenTurns: z.array(nonNegInt),
  openTurn: nonNegInt.nullable()
});
var rewindWireSchema = z.object({
  anchors: z.array(z.object({
    n: nonNegInt,
    seq: nonNegInt,
    turn: nonNegInt.nullable(),
    time: nonNegInt,
    preview: z.string()
  })),
  hiddenTurns: z.array(nonNegInt)
});
function readNonNegInt(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function readText(payload) {
  const record = payload;
  if (typeof record !== "object" || record === null) return "";
  const content = Array.isArray(record.content) ? record.content : Array.isArray(record.message?.content) ? record.message.content : [];
  return content.filter((block) => typeof block === "object" && block !== null && block.type === "text" && typeof block.text === "string").map((block) => block.text).join("");
}
function isUserSource(payload) {
  const record = payload;
  if (typeof record !== "object" || record === null) return false;
  const source = record.source;
  if (typeof source !== "object" || source === null) return false;
  return source.kind === "user";
}
function readSurfaceOp(event) {
  const raw = event.surfaceOp;
  if (raw === void 0) return void 0;
  if (raw === "append") return "append";
  if (typeof raw !== "object" || raw === null) return void 0;
  const op = raw;
  if (op.op !== "replace") return void 0;
  const startSeq = readNonNegInt(op.startSeq);
  const endSeq = readNonNegInt(op.endSeq);
  return startSeq === null || endSeq === null ? void 0 : { startSeq, endSeq };
}
var SURFACE_EVENT_TYPES = /* @__PURE__ */ new Set([
  "system/message",
  "developer/message",
  "user/message",
  "assistant/message",
  "tool/result"
]);
function initRewindState() {
  return { nodes: [], hiddenTurns: [], openTurn: null };
}
function applyRewindEvent(state, event) {
  const candidate = event;
  if (typeof candidate !== "object" || candidate === null) return state;
  const type = candidate.type;
  if (typeof type !== "string") return state;
  if (type === "turn/start") {
    const turn = readNonNegInt(candidate.data?.turn);
    return turn === null || turn === state.openTurn ? state : { ...state, openTurn: turn };
  }
  if (!SURFACE_EVENT_TYPES.has(type)) return state;
  const op = readSurfaceOp(candidate);
  if (op === void 0) return state;
  const seq = readNonNegInt(candidate.seq);
  if (seq === null) return state;
  const time = readNonNegInt(candidate.time) ?? 0;
  const prompt = type === "user/message" && isUserSource(candidate.data);
  const text = prompt ? readText(candidate.data) : "";
  const node = { seq, time, turn: state.openTurn, prompt, text };
  if (op === "append") {
    return { ...state, nodes: [...state.nodes, node] };
  }
  const startIdx = state.nodes.findIndex((item) => item.seq === op.startSeq);
  const endIdx = state.nodes.findIndex((item) => item.seq === op.endSeq);
  if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) return state;
  if (!isOwnReplacement(candidate)) {
    return {
      ...state,
      nodes: [...state.nodes.slice(0, startIdx), node, ...state.nodes.slice(endIdx + 1)]
    };
  }
  const shadowed = state.nodes.slice(startIdx, endIdx + 1);
  const hiddenTurns = [...state.hiddenTurns];
  for (const item of shadowed) {
    if (item.turn !== null && !hiddenTurns.includes(item.turn)) hiddenTurns.push(item.turn);
  }
  hiddenTurns.sort((a, b) => a - b);
  return {
    ...state,
    nodes: [...state.nodes.slice(0, startIdx), node, ...state.nodes.slice(endIdx + 1)],
    hiddenTurns
  };
}
function isOwnReplacement(event) {
  const data = event.data;
  return data?.source?.kind === REWIND_SOURCE_KIND;
}
function rewindView(state) {
  const anchors = [];
  const openers = /* @__PURE__ */ new Set();
  const claimed = /* @__PURE__ */ new Set();
  for (const node of state.nodes) {
    if (!node.prompt) continue;
    if (node.turn === null) {
      openers.add(node.seq);
      continue;
    }
    if (claimed.has(node.turn)) continue;
    claimed.add(node.turn);
    openers.add(node.seq);
  }
  for (let i = state.nodes.length - 1; i >= 0 && anchors.length < MAX_ANCHORS; i -= 1) {
    const node = state.nodes[i];
    if (!openers.has(node.seq)) continue;
    anchors.push({
      n: anchors.length + 1,
      seq: node.seq,
      turn: node.turn,
      time: node.time,
      preview: previewText(node.text)
    });
  }
  return { anchors, hiddenTurns: state.hiddenTurns };
}
var rewindProjection = {
  key: REWIND_PROJECTION_KEY,
  stateSchema: rewindStateSchema,
  init: () => initRewindState(),
  apply: applyRewindEvent,
  wire: {
    viewSchema: rewindWireSchema,
    view: rewindView
  },
  stateVersion: 2
};

// src/index.ts
import { resolveDshHome as resolveDshHome2 } from "@deepseek-ai/dsh-home-paths";

// src/routes.ts
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";

// src/quarantine.ts
import { readFile as readFile2, readdir, rm as rm2, stat as stat2 } from "node:fs/promises";
import { join as join2 } from "node:path";
async function readManifest(slotDir) {
  try {
    const parsed = JSON.parse(await readFile2(join2(slotDir, MANIFEST_NAME), "utf8"));
    if (typeof parsed !== "object" || parsed === null) return void 0;
    const record = parsed;
    if (typeof record.originalPath !== "string") return void 0;
    if (record.kind !== "replaced" && record.kind !== "created") return void 0;
    return {
      originalPath: record.originalPath,
      kind: record.kind,
      at: typeof record.at === "number" && Number.isSafeInteger(record.at) ? record.at : 0
    };
  } catch {
    return void 0;
  }
}
async function slotBytes(slotDir) {
  let total = 0;
  try {
    for (const name2 of await readdir(slotDir)) {
      try {
        const info = await stat2(join2(slotDir, name2));
        if (info.isFile()) total += info.size;
      } catch {
      }
    }
  } catch {
  }
  return total;
}
async function listQuarantine(dshHome) {
  const root = quarantineBase(dshHome);
  let sessions;
  try {
    sessions = await readdir(root);
  } catch {
    return { groups: [], entries: 0, bytes: 0 };
  }
  const groups = [];
  let entries = 0;
  let bytes = 0;
  for (const sessionId of sessions) {
    const sessionDir = join2(root, sessionId);
    let slots;
    try {
      slots = await readdir(sessionDir);
    } catch {
      continue;
    }
    const rows = [];
    for (const slot of slots) {
      const slotDir = join2(sessionDir, slot);
      const manifest = await readManifest(slotDir);
      const size = await slotBytes(slotDir);
      rows.push({
        sessionId,
        slot,
        kind: manifest?.kind ?? "unknown",
        ...manifest === void 0 ? {} : { originalPath: manifest.originalPath },
        ...manifest === void 0 || manifest.at === 0 ? {} : { at: manifest.at },
        bytes: size
      });
      entries += 1;
      bytes += size;
    }
    rows.sort((left, right) => right.slot.localeCompare(left.slot));
    if (rows.length === 0) continue;
    groups.push({
      sessionId,
      entries: rows,
      bytes: rows.reduce((sum, row) => sum + row.bytes, 0)
    });
  }
  groups.sort((left, right) => left.sessionId.localeCompare(right.sessionId));
  return { groups, entries, bytes };
}
async function purgeQuarantine(dshHome, targets) {
  const failed = [];
  let removed = 0;
  for (const target of targets) {
    if (!isSafeSegment(target.sessionId) || !isSafeSegment(target.slot)) {
      failed.push(`${target.sessionId}/${target.slot}`);
      continue;
    }
    const dir = join2(quarantineRoot(dshHome, target.sessionId), target.slot);
    try {
      await rm2(dir, { recursive: true, force: true });
      removed += 1;
    } catch {
      failed.push(`${target.sessionId}/${target.slot}`);
    }
  }
  return { removed, failed };
}
function isSafeSegment(value) {
  if (value === "" || value === "." || value === "..") return false;
  if (value.includes("/") || value.includes("\\")) return false;
  if (/^[a-zA-Z]:/.test(value)) return false;
  return !value.includes("\0");
}

// src/routes.ts
var ROUTE_PREFIX = "/api/plugins/dsh-rewind-plugin";
var MAX_BODY_BYTES = 1e6;
var MAX_TARGETS_PER_CALL = 5e3;
function sendJson(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}
function ok(value) {
  return sendJson(200, { ok: true, value });
}
function fail(status, code, host) {
  return sendJson(status, { ok: false, error: { code, message: host.text ?? host.code, host } });
}
async function readJsonBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return void 0;
  if (text.trim() === "") return {};
  try {
    return JSON.parse(text);
  } catch {
    return void 0;
  }
}
function readTargets(body) {
  const raw = body?.targets;
  if (!Array.isArray(raw) || raw.length > MAX_TARGETS_PER_CALL) return void 0;
  const out = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) return void 0;
    const { sessionId, slot } = entry;
    if (typeof sessionId !== "string" || typeof slot !== "string") return void 0;
    out.push({ sessionId, slot });
  }
  return out;
}
function readPurgeAll(body) {
  return body?.all === true;
}
function registerQuarantineRoutes(connectionFetch) {
  const listFetch = async () => {
    try {
      return ok(await listQuarantine(resolveDshHome()));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return fail(500, "list-failed", {
        code: "rewind.route.listFailed",
        params: { detail },
        text: `could not read the quarantine: ${detail}`
      });
    }
  };
  const purgeFetch = async (request) => {
    const body = await readJsonBody(request);
    if (body === void 0) {
      return fail(400, "bad-request", {
        code: "rewind.route.badBody",
        text: "the body must be JSON and within the size limit"
      });
    }
    const dshHome = resolveDshHome();
    try {
      if (readPurgeAll(body)) {
        const listing = await listQuarantine(dshHome);
        const every = listing.groups.flatMap((group) => group.entries.map((entry) => ({
          sessionId: group.sessionId,
          slot: entry.slot
        })));
        if (every.length > MAX_TARGETS_PER_CALL) {
          return fail(400, "too-many", {
            code: "rewind.route.tooMany",
            params: { max: MAX_TARGETS_PER_CALL },
            text: `more than ${String(MAX_TARGETS_PER_CALL)} slots; purge in batches`
          });
        }
        const result2 = await purgeQuarantine(dshHome, every);
        return ok({ ...result2, requested: every.length });
      }
      const targets = readTargets(body);
      if (targets === void 0) {
        return fail(400, "bad-request", {
          code: "rewind.route.targetsRequired",
          text: "the body needs a targets array of { sessionId, slot } pairs, or all: true"
        });
      }
      const result = await purgeQuarantine(dshHome, targets);
      return ok({ ...result, requested: targets.length });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return fail(500, "purge-failed", {
        code: "rewind.route.purgeFailed",
        params: { detail },
        text: `could not purge the quarantine: ${detail}`
      });
    }
  };
  const disposers = [
    connectionFetch.register({
      path: `${ROUTE_PREFIX}/quarantine`,
      methods: ["GET"],
      requestBody: "buffered",
      fetch: listFetch
    }),
    connectionFetch.register({
      path: `${ROUTE_PREFIX}/quarantine/purge`,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: purgeFetch
    })
  ];
  return async () => {
    for (const dispose of disposers) await dispose();
  };
}

// src/index.ts
var name = "plugin-rewind";
var inject = ["commands", "sessionProjections"];
var Config = z2.object({
  maxAnchors: z2.natural().default(MAX_ANCHORS)
});
function parseOrdinal(raw) {
  const text = raw.trim();
  if (text === "") return { kind: "list" };
  const plan = /^plan\s+(\d+)$/.exec(text);
  if (plan !== null) {
    const n2 = Number(plan[1]);
    return Number.isSafeInteger(n2) && n2 >= 1 ? { kind: "plan", n: n2 } : { kind: "bad" };
  }
  if (!/^\d+$/.test(text)) return { kind: "bad" };
  const n = Number(text);
  return Number.isSafeInteger(n) && n >= 1 ? { kind: "n", n } : { kind: "bad" };
}
function coded(code, params, text, extra) {
  return JSON.stringify({
    ...hostText(code, params, text),
    ...extra ?? {}
  });
}
function apply(ctx, config) {
  const log = ctx.logger(name);
  const maxAnchors = Number.isSafeInteger(config.maxAnchors) && config.maxAnchors >= 1 ? config.maxAnchors : MAX_ANCHORS;
  const { recorder, record } = createRecorder();
  ctx.inject(["connection"], (scope) => {
    const fetch = scope.get("connection")?.fetch;
    if (fetch === void 0) return;
    scope.effect(() => registerQuarantineRoutes(fetch), "plugin-rewind: quarantine routes");
  });
  ctx.effect(
    () => ctx.sessionProjections.register(rewindProjection),
    "plugin-rewind: rewindAnchors projection"
  );
  const onIntent = (name2) => {
    ctx.effect(() => ctx.on(name2, (target, exec, next) => {
      const path = processPathOf(ctx, target);
      if (path === "") {
        log.warn(`rewind: ${name2} carried no process path; the change was not recorded`);
        return next();
      }
      if (sessionOfExec(exec) === void 0) {
        log.warn(`rewind: ${name2} carried no tool-execution context; ${path} was not recorded`);
        return next();
      }
      record(path, turnOfExec(exec), seqOfExec(exec));
      return next();
    }, { prepend: true }), `plugin-rewind: ${name2} recorder`);
  };
  onIntent("fs/write-intent");
  onIntent("fs/edit-intent");
  const handle = async (invocation) => {
    const session = invocation.agent.session;
    const parsed = parseOrdinal(invocation.rawInput);
    if (parsed.kind === "bad") {
      return { kind: "error", text: coded("rewind.host.badArg") };
    }
    if (parsed.kind === "list") {
      const anchors = listAnchors(session, maxAnchors);
      if (anchors.length === 0) {
        return { kind: "error", text: coded("rewind.host.empty") };
      }
      return { kind: "success", text: coded("rewind.host.list", { count: anchors.length }) };
    }
    if (invocation.agent.status === "running") {
      return { kind: "error", text: coded("rewind.host.busy") };
    }
    const plan = planCut(session, parsed.n, maxAnchors);
    if ("reason" in plan) {
      const failureCode = plan.reason === "empty" ? "rewind.host.empty" : plan.reason === "outOfRange" ? "rewind.host.outOfRange" : "rewind.host.notUserMessage";
      const failureParams = plan.reason === "outOfRange" ? { available: plan.available, requested: parsed.n } : void 0;
      if (parsed.kind === "plan") {
        return {
          kind: "success",
          text: coded("rewind.host.plan", void 0, void 0, {
            ok: false,
            reason: failureCode,
            ...failureParams === void 0 ? {} : { params: failureParams }
          })
        };
      }
      return { kind: "error", text: coded(failureCode, failureParams) };
    }
    if (parsed.kind === "plan") {
      const preview = await previewRevert(String(session.header.id), plan.turns, recorder);
      return {
        kind: "success",
        text: coded("rewind.host.plan", void 0, void 0, {
          ok: true,
          n: parsed.n,
          prompt: plan.prompt,
          ...preview
        })
      };
    }
    const turns = plan.turns;
    let revert;
    try {
      revert = await revertFiles(String(session.header.id), turns, recorder, log);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log.warn(`rewind: file revert failed: ${detail}`);
      revert = { restored: 0, removed: 0, unrestorable: [{ path: "(all)", reason: detail }] };
    }
    let sourceEventSeq;
    try {
      const replacement = session.append("user/message", placeholderData(), {
        surfaceOp: { op: "replace", startSeq: SessionSeq(plan.startSeq), endSeq: SessionSeq(plan.endSeq) },
        sourceEventSeqs: plan.shadowedSeqs.map((seq) => SessionSeq(seq))
      });
      sourceEventSeq = replacement.seq;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log.warn(`rewind: replacement rejected: ${detail}`);
      return { kind: "error", text: coded("rewind.host.rejected", void 0, detail) };
    }
    recorder.forget(plan.turns);
    return {
      kind: "success",
      // The recalled text travels WITH the result, so the composer gets it
      // exactly once — a durable projection would replay it on every reload.
      // The file revert's tally rides the same payload; see `coded`.
      text: coded("rewind.host.done", { n: parsed.n }, void 0, {
        prompt: plan.prompt,
        ...revert === void 0 ? {} : { files: revert }
      }),
      sourceEventSeq
    };
  };
  ctx.effect(() => ctx.commands.register({
    name: REWIND_COMMAND,
    description: "Recall a sent message: cut the conversation back to before it and put its text back in the composer",
    // Declaring `input` is required: without it the composer treats the whole
    // line as a bare command name and `/rewind 2` never reaches the handler.
    // The hint is English because a host half carries no user-visible prose;
    // the composer shows it as the field's placeholder.
    input: { hint: "Ordinal (1 = newest), or leave empty to list recallable messages" },
    handler: (invocation) => handle(invocation)
  }), "plugin-rewind: /rewind command");
}
function processPathOf(ctx, target) {
  const fs = ctx.get("fs");
  if (typeof fs?.processPath !== "function") return "";
  try {
    return fs.processPath(target);
  } catch {
    return "";
  }
}
function turnOfExec(exec) {
  const session = sessionOfExec(exec);
  if (session?.ownEvents === void 0) return null;
  const seq = typeof session.seq === "number" ? session.seq : Number.MAX_SAFE_INTEGER;
  try {
    return turnAt(session.ownEvents(), seq);
  } catch {
    return null;
  }
}
function seqOfExec(exec) {
  const seq = sessionOfExec(exec)?.seq;
  return typeof seq === "number" && Number.isSafeInteger(seq) ? seq : 0;
}
function sessionOfExec(exec) {
  const agent = exec?.agent;
  const session = agent?.session;
  return typeof session === "object" && session !== null ? session : void 0;
}
function planPaths(turns, recorder) {
  const firstByPath = /* @__PURE__ */ new Map();
  for (const change of recorder.changesForTurns(turns)) {
    if (!firstByPath.has(change.path)) firstByPath.set(change.path, change);
  }
  return { targets: [...firstByPath.values()], failures: recorder.failuresForTurns(turns) };
}
async function previewRevert(sessionId, turns, recorder) {
  const { targets, failures } = planPaths(turns, recorder);
  const restore = [];
  const remove = [];
  for (const target of targets) {
    const current = await captureBefore(target.path);
    const now = current.kind === "captured" ? current.before : void 0;
    if (target.before === null) {
      remove.push({
        path: target.path,
        action: "remove",
        ...now === null || now === void 0 ? {} : { current: now }
      });
      continue;
    }
    restore.push({
      path: target.path,
      action: "restore",
      ...now === null || now === void 0 ? {} : { current: now },
      next: target.before
    });
  }
  void sessionId;
  return { restore, remove, unrestorable: failures.map((f) => ({ path: f.path, reason: f.reason })) };
}
async function revertFiles(sessionId, turns, recorder, log) {
  const { targets, failures } = planPaths(turns, recorder);
  const dir = quarantineRoot(resolveDshHome2(), sessionId);
  const now = Date.now();
  const unrestorable = failures.map((f) => ({ path: f.path, reason: f.reason }));
  let restored = 0;
  let removed = 0;
  for (const snapshot of targets) {
    const outcome = await restoreOne({ path: snapshot.path, before: snapshot.before }, dir, now);
    if (outcome.kind === "restored") restored += 1;
    else if (outcome.kind === "removed") removed += 1;
    else {
      unrestorable.push({ path: snapshot.path, reason: outcome.reason ?? "unknown" });
      log.warn(`rewind: could not restore ${snapshot.path}: ${outcome.reason ?? "unknown"}`);
    }
  }
  return { restored, removed, unrestorable };
}
export {
  Config,
  apply,
  inject,
  name
};
