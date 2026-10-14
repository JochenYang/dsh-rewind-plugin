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
async function captureBefore(path, maxBytes = MAX_SNAPSHOT_BYTES) {
  try {
    const info = await stat(path);
    if (!info.isFile()) return { kind: "unreadable", reason: "not a regular file" };
    if (info.size > maxBytes) return { kind: "too-large" };
    return { kind: "captured", before: await readFile(path) };
  } catch (error) {
    if (error.code === "ENOENT") return { kind: "captured", before: null };
    return { kind: "unreadable", reason: error instanceof Error ? error.message : String(error) };
  }
}
function isTextBytes(bytes) {
  return !bytes.includes(0);
}
function textOf(bytes) {
  if (bytes === null || bytes === void 0) return void 0;
  return isTextBytes(bytes) ? bytes.toString("utf8") : void 0;
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
async function restoreOne(snapshot, quarantineDir, now, maxBytes = MAX_SNAPSHOT_BYTES) {
  const slot = join(quarantineDir, `${stamp(now)}-${Math.abs(hash(snapshot.path))}`);
  try {
    const current = await captureBefore(snapshot.path, maxBytes);
    if (current.kind === "unreadable") return { kind: "failed", reason: current.reason };
    if (current.kind === "too-large") {
      return { kind: "failed", reason: "the current file is too large to quarantine safely" };
    }
    const present = current.before;
    await mkdir(slot, { recursive: true });
    const writeManifest2 = (kind) => writeFile(
      join(slot, MANIFEST_NAME),
      JSON.stringify({ originalPath: snapshot.path, kind, at: now }),
      "utf8"
    );
    if (snapshot.before === null) {
      if (present === null) return { kind: "removed" };
      await writeFile(join(slot, "created"), present);
      await writeManifest2("created");
      await rm(snapshot.path, { force: true });
      return { kind: "removed", slot };
    }
    if (present !== null) {
      await writeFile(join(slot, "replaced"), present);
      await writeManifest2("replaced");
    }
    await mkdir(dirname(snapshot.path), { recursive: true });
    await writeFile(snapshot.path, snapshot.before);
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
      changesForTurns(sessionId, turns) {
        const wanted = new Set(turns);
        return changes.filter((c) => c.sessionId === sessionId && c.turn !== null && wanted.has(c.turn)).sort((a, b) => a.seq - b.seq);
      },
      failuresForTurns(sessionId, turns) {
        const wanted = new Set(turns);
        return failures.filter((f) => f.sessionId === sessionId && f.turn !== null && wanted.has(f.turn));
      },
      forget(sessionId, turns) {
        const wanted = new Set(turns);
        for (let i = changes.length - 1; i >= 0; i -= 1) {
          const change = changes[i];
          if (change.sessionId !== sessionId) continue;
          if (change.turn !== null && wanted.has(change.turn)) changes.splice(i, 1);
        }
        for (let i = failures.length - 1; i >= 0; i -= 1) {
          const failure = failures[i];
          if (failure.sessionId !== sessionId) continue;
          if (failure.turn !== null && wanted.has(failure.turn)) failures.splice(i, 1);
        }
      },
      size() {
        return changes.length;
      }
    },
    async record(sessionId, path, turn, seq) {
      const key = `${sessionId}\0${path}\0${String(seq)}`;
      if (seen.has(key)) return;
      seen.add(key);
      const result = await capture(path);
      if (result.kind === "captured") {
        changes.push({ sessionId, path, before: result.before, turn, seq });
        return;
      }
      failures.push({
        sessionId,
        path,
        turn,
        reason: result.kind === "too-large" ? "the file is too large to snapshot" : result.reason
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

// src/trees.ts
import { createHash } from "node:crypto";
import { mkdir as mkdir2, readFile as readFile2, readdir, realpath, rename, rm as rm2, stat as stat2, writeFile as writeFile2 } from "node:fs/promises";
import { join as join2, relative, resolve, sep } from "node:path";
var DEFAULT_TREE_LIMITS = {
  maxFiles: 2e4,
  maxTotalBytes: 128 * 1024 * 1024,
  maxFileBytes: 4 * 1024 * 1024,
  maxWalkMs: 1500,
  skipDirs: [
    ".git",
    ".hg",
    ".svn",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".cache",
    ".turbo",
    ".parcel-cache",
    "coverage"
  ],
  maxSnapshotsPerSession: 200,
  maxBlobBytes: 1024 * 1024 * 1024,
  maxManifestAgeMs: 30 * 24 * 60 * 60 * 1e3
};
function treesRoot(dshHome, sessionId) {
  return join2(dshHome, "storages", "dsh-rewind-plugin", "trees", sessionId);
}
function blobsRoot(dshHome) {
  return join2(dshHome, "storages", "dsh-rewind-plugin", "blobs");
}
var inFlight = /* @__PURE__ */ new Set();
function manifestPath(dshHome, sessionId, turn) {
  return join2(treesRoot(dshHome, sessionId), `${String(turn)}.json`);
}
function hashOf(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
function pathKey(path) {
  const resolved = resolve(path);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
function blobPath(dshHome, hash2) {
  return join2(blobsRoot(dshHome), hash2.slice(0, 2), hash2);
}
async function putBlob(dshHome, bytes) {
  const hash2 = hashOf(bytes);
  inFlight.add(hash2);
  const path = blobPath(dshHome, hash2);
  await mkdir2(join2(blobsRoot(dshHome), hash2.slice(0, 2)), { recursive: true });
  try {
    await writeFile2(path, bytes, { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  return hash2;
}
async function getBlob(dshHome, hash2) {
  try {
    const bytes = await readFile2(blobPath(dshHome, hash2));
    return hashOf(bytes) === hash2 ? bytes : void 0;
  } catch {
    return void 0;
  }
}
async function walkWorkspace(root, limits, signal) {
  const files = /* @__PURE__ */ new Map();
  const uncaptured = /* @__PURE__ */ new Map();
  const skip = new Set(limits.skipDirs);
  const deadline = Date.now() + limits.maxWalkMs;
  let bytes = 0;
  let reason;
  const stack = [root];
  while (stack.length > 0) {
    if (signal?.aborted === true) {
      reason = "cancelled";
      break;
    }
    if (Date.now() > deadline) {
      reason = "timeout";
      break;
    }
    const dir = stack.pop();
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      reason ??= "unreadable-directory";
      continue;
    }
    for (const entry of entries) {
      const abs = join2(dir, entry.name);
      const rel = relative(root, abs).split(sep).join("/");
      if (entry.isSymbolicLink()) {
        let info2;
        try {
          info2 = await stat2(abs);
        } catch {
          uncaptured.set(rel, { size: 0, mtimeMs: 0, reason: "symlink" });
          continue;
        }
        if (info2.isDirectory()) {
          reason ??= "symlink";
          continue;
        }
        uncaptured.set(rel, {
          size: info2.size,
          mtimeMs: Math.trunc(info2.mtimeMs),
          reason: "symlink"
        });
        continue;
      }
      if (entry.isDirectory()) {
        if (!skip.has(entry.name)) stack.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      if (files.size >= limits.maxFiles) {
        reason = "file-count";
        break;
      }
      let info;
      try {
        info = await stat2(abs);
      } catch {
        uncaptured.set(rel, { size: 0, mtimeMs: 0, reason: "unreadable" });
        continue;
      }
      bytes += info.size;
      if (bytes > limits.maxTotalBytes) {
        reason = "total-bytes";
        break;
      }
      files.set(rel, { abs, size: info.size, mtimeMs: Math.trunc(info.mtimeMs) });
    }
    if (reason === "file-count" || reason === "total-bytes") break;
  }
  return { files, uncaptured, complete: reason === void 0, ...reason === void 0 ? {} : { reason } };
}
async function captureWorkspace(dshHome, sessionId, turn, root, limits, previous, signal) {
  const canonical = await realpath(root).catch(() => root);
  const walk = await walkWorkspace(canonical, limits, signal);
  const entries = /* @__PURE__ */ Object.create(null);
  const uncaptured = /* @__PURE__ */ Object.create(null);
  for (const [rel, found] of walk.uncaptured) uncaptured[rel] = found;
  const deadline = Date.now() + limits.maxWalkMs;
  let reason = walk.reason;
  try {
    for (const [rel, found] of walk.files) {
      if (reason === void 0 && (signal?.aborted === true || Date.now() > deadline)) {
        reason = signal?.aborted === true ? "cancelled" : "timeout";
      }
      if (found.size > limits.maxFileBytes) {
        uncaptured[rel] = { size: found.size, mtimeMs: found.mtimeMs, reason: "too-large" };
        continue;
      }
      const before = previous?.entries[rel];
      if (before !== void 0 && before[1] === found.size && before[2] === found.mtimeMs) {
        entries[rel] = before;
        continue;
      }
      let bytes;
      try {
        bytes = await readFile2(found.abs);
      } catch {
        uncaptured[rel] = { size: found.size, mtimeMs: found.mtimeMs, reason: "unreadable" };
        continue;
      }
      entries[rel] = [await putBlob(dshHome, bytes), found.size, found.mtimeMs];
    }
  } finally {
    inFlight.clear();
  }
  const snapshot = {
    v: 1,
    sessionId,
    turn,
    at: Date.now(),
    root: canonical,
    complete: reason === void 0,
    ...reason === void 0 ? {} : { reason },
    entries,
    uncaptured
  };
  await writeManifest(dshHome, snapshot);
  return snapshot;
}
async function writeManifest(dshHome, snapshot) {
  const dir = treesRoot(dshHome, snapshot.sessionId);
  await mkdir2(dir, { recursive: true });
  const path = manifestPath(dshHome, snapshot.sessionId, snapshot.turn);
  const temp = `${path}.tmp`;
  await writeFile2(temp, JSON.stringify(snapshot), "utf8");
  await rename(temp, path);
}
async function readSnapshot(dshHome, sessionId, turn) {
  try {
    const parsed = JSON.parse(
      await readFile2(manifestPath(dshHome, sessionId, turn), "utf8")
    );
    if (parsed?.v !== 1 || typeof parsed.entries !== "object") return void 0;
    return parsed;
  } catch {
    return void 0;
  }
}
async function latestSnapshotBefore(dshHome, sessionId, turn) {
  let names;
  try {
    names = await readdir(treesRoot(dshHome, sessionId));
  } catch {
    return void 0;
  }
  const earlier = names.filter((name2) => name2.endsWith(".json")).map((name2) => Number(name2.slice(0, -".json".length))).filter((candidate) => Number.isSafeInteger(candidate) && candidate < turn).sort((a, b) => b - a);
  const nearest = earlier[0];
  return nearest === void 0 ? void 0 : readSnapshot(dshHome, sessionId, nearest);
}
async function diffWorkspace(snapshot, dshHome, limits, signal) {
  const walk = await walkWorkspace(snapshot.root, limits, signal);
  const restore = [];
  const missing = [];
  const uncapturedChanged = [];
  const currentComplete = walk.complete;
  for (const [rel, [hash2, size, mtimeMs]] of Object.entries(snapshot.entries ?? {})) {
    const abs = join2(snapshot.root, rel);
    const found = walk.files.get(rel);
    if (found === void 0) {
      if (!currentComplete) continue;
      const bytes = await getBlob(dshHome, hash2);
      if (bytes === void 0) {
        missing.push(abs);
        continue;
      }
      restore.push({ path: abs, before: bytes });
      continue;
    }
    if (found.size !== size || found.mtimeMs !== mtimeMs) {
      let bytes;
      try {
        bytes = await readFile2(found.abs);
      } catch {
        missing.push(abs);
        continue;
      }
      if (hashOf(bytes) !== hash2) {
        const before = await getBlob(dshHome, hash2);
        if (before === void 0) {
          missing.push(abs);
          continue;
        }
        restore.push({ path: abs, before });
      }
    }
  }
  for (const [rel, known] of Object.entries(snapshot.uncaptured ?? {})) {
    const found = walk.files.get(rel);
    if (found === void 0 || found.size !== known.size || found.mtimeMs !== known.mtimeMs) {
      uncapturedChanged.push(join2(snapshot.root, rel));
    }
  }
  const removalsSuppressed = !snapshot.complete || !currentComplete;
  if (!removalsSuppressed) {
    for (const rel of walk.files.keys()) {
      if (Object.hasOwn(snapshot.entries ?? {}, rel) || Object.hasOwn(snapshot.uncaptured ?? {}, rel)) continue;
      restore.push({ path: join2(snapshot.root, rel), before: null });
    }
  }
  return {
    restore,
    missing,
    removalsSuppressed,
    uncapturedChanged,
    coveredOf(path) {
      const rel = relative(snapshot.root, path).split(sep).join("/");
      if (rel === "" || rel.startsWith("..") || rel.includes(":")) return false;
      if (Object.hasOwn(snapshot.uncaptured ?? {}, rel)) return false;
      if (Object.hasOwn(snapshot.entries ?? {}, rel)) return true;
      return !removalsSuppressed && walk.files.has(rel);
    }
  };
}
async function dropSnapshots(dshHome, sessionId, turns) {
  for (const turn of turns) {
    try {
      await rm2(manifestPath(dshHome, sessionId, turn), { force: true });
    } catch {
    }
  }
  await collectGarbage(dshHome);
}
async function pruneSnapshots(dshHome, sessionId, limits) {
  const turns = await manifestTurns(dshHome, sessionId);
  const excess = turns.slice(0, Math.max(0, turns.length - limits.maxSnapshotsPerSession));
  for (const turn of excess) {
    await rm2(manifestPath(dshHome, sessionId, turn), { force: true });
  }
  await collectGarbage(dshHome);
}
async function manifestTurns(dshHome, sessionId) {
  try {
    return (await readdir(treesRoot(dshHome, sessionId))).filter((name2) => name2.endsWith(".json")).map((name2) => Number(name2.slice(0, -".json".length))).filter((turn) => Number.isSafeInteger(turn)).sort((a, b) => a - b);
  } catch {
    return [];
  }
}
async function collectGarbage(dshHome, limits = DEFAULT_TREE_LIMITS) {
  const treesDir = join2(dshHome, "storages", "dsh-rewind-plugin", "trees");
  const manifests = [];
  let sessions;
  try {
    sessions = await readdir(treesDir);
  } catch {
    return;
  }
  for (const session of sessions) {
    let names;
    try {
      names = await readdir(join2(treesDir, session));
    } catch {
      continue;
    }
    for (const name2 of names) {
      if (!name2.endsWith(".json")) continue;
      const path = join2(treesDir, session, name2);
      try {
        const parsed = JSON.parse(await readFile2(path, "utf8"));
        manifests.push({
          path,
          at: typeof parsed.at === "number" ? parsed.at : 0,
          hashes: Object.values(parsed.entries ?? {}).map((entry) => entry[0])
        });
      } catch {
      }
    }
  }
  const cutoff = Date.now() - limits.maxManifestAgeMs;
  const live = [];
  for (const manifest of manifests) {
    if (manifest.at < cutoff) {
      try {
        await rm2(manifest.path, { force: true });
      } catch {
        live.push(manifest);
      }
      continue;
    }
    live.push(manifest);
  }
  const root = blobsRoot(dshHome);
  let prefixes;
  try {
    prefixes = await readdir(root);
  } catch {
    return;
  }
  const blobs = /* @__PURE__ */ new Map();
  let total = 0;
  for (const prefix of prefixes) {
    let hashes;
    try {
      hashes = await readdir(join2(root, prefix));
    } catch {
      continue;
    }
    for (const hash2 of hashes) {
      const path = join2(root, prefix, hash2);
      try {
        const info = await stat2(path);
        blobs.set(hash2, { path, size: info.size });
        total += info.size;
      } catch {
      }
    }
  }
  const referenced = /* @__PURE__ */ new Map();
  for (const manifest of live) {
    for (const hash2 of manifest.hashes) referenced.set(hash2, (referenced.get(hash2) ?? 0) + 1);
  }
  if (total > limits.maxBlobBytes) {
    for (const manifest of [...live].sort((a, b) => a.at - b.at)) {
      if (total <= limits.maxBlobBytes) break;
      try {
        await rm2(manifest.path, { force: true });
      } catch {
        continue;
      }
      live.splice(live.indexOf(manifest), 1);
      for (const hash2 of manifest.hashes) {
        const count = (referenced.get(hash2) ?? 0) - 1;
        if (count <= 0) {
          referenced.delete(hash2);
          total -= blobs.get(hash2)?.size ?? 0;
        } else {
          referenced.set(hash2, count);
        }
      }
    }
  }
  for (const [hash2, blob] of blobs) {
    if (referenced.has(hash2) || inFlight.has(hash2)) continue;
    try {
      await rm2(blob.path, { force: true });
    } catch {
    }
  }
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
import { readFile as readFile3, readdir as readdir2, rm as rm3, stat as stat3 } from "node:fs/promises";
import { join as join3 } from "node:path";
async function readManifest(slotDir) {
  try {
    const parsed = JSON.parse(await readFile3(join3(slotDir, MANIFEST_NAME), "utf8"));
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
    for (const name2 of await readdir2(slotDir)) {
      try {
        const info = await stat3(join3(slotDir, name2));
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
    sessions = await readdir2(root);
  } catch {
    return { groups: [], entries: 0, bytes: 0 };
  }
  const groups = [];
  let entries = 0;
  let bytes = 0;
  for (const sessionId of sessions) {
    const sessionDir = join3(root, sessionId);
    let slots;
    try {
      slots = await readdir2(sessionDir);
    } catch {
      continue;
    }
    const rows = [];
    for (const slot of slots) {
      const slotDir = join3(sessionDir, slot);
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
    const dir = join3(quarantineRoot(dshHome, target.sessionId), target.slot);
    try {
      await rm3(dir, { recursive: true, force: true });
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
  maxAnchors: z2.natural().default(MAX_ANCHORS),
  snapshotWorkspace: z2.boolean().default(true),
  maxSnapshotFiles: z2.natural().default(DEFAULT_TREE_LIMITS.maxFiles),
  maxSnapshotBytes: z2.natural().default(DEFAULT_TREE_LIMITS.maxTotalBytes)
});
var RECORDER_TOOLS = /* @__PURE__ */ new Set(["write", "edit", "str_replace_editor"]);
var READ_ONLY_TOOLS = /* @__PURE__ */ new Set([
  "read",
  "read_image",
  "glob",
  "grep",
  "web_search",
  "web_fetch",
  "ask_user_question",
  "todo_write",
  "job_list",
  "job_output",
  "skill",
  "present",
  "memory_recall",
  "session_search",
  "session_event_search"
]);
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
  const limits = {
    ...DEFAULT_TREE_LIMITS,
    maxFiles: positive(config.maxSnapshotFiles, DEFAULT_TREE_LIMITS.maxFiles),
    maxTotalBytes: positive(config.maxSnapshotBytes, DEFAULT_TREE_LIMITS.maxTotalBytes)
  };
  const snapshotWorkspace = config.snapshotWorkspace !== false;
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
    ctx.effect(() => ctx.on(name2, async (target, exec, next) => {
      const path = String(target?.targetKey ?? "");
      const info = sessionInfoOfExec(exec);
      if (path !== "" && info !== void 0) {
        try {
          await record(info.id, path, info.turn, seqOfExec(exec));
        } catch (error) {
          log.warn(`rewind: could not snapshot ${path}: ${messageOf(error)}`);
        }
      }
      return next();
    }, { prepend: true }), `plugin-rewind: ${name2} recorder`);
  };
  onIntent("fs/write-intent");
  onIntent("fs/edit-intent");
  const captured = /* @__PURE__ */ new Set();
  ctx.effect(() => ctx.on("tools/pre-execute", async (exec, next) => {
    const info = sessionInfoOfExec(exec);
    const tool = String(exec?.name ?? "");
    if (snapshotWorkspace && info !== void 0 && info.cwd !== void 0 && !READ_ONLY_TOOLS.has(tool)) {
      try {
        await ensureSnapshot({ id: info.id, cwd: info.cwd, turn: info.turn }, signalOfExec(exec));
      } catch (error) {
        log.warn(`rewind: workspace snapshot failed: ${messageOf(error)}`);
      }
    }
    return next();
  }, { prepend: true }), "plugin-rewind: workspace snapshot gate");
  async function ensureSnapshot(info, signal) {
    const key = `${info.id}\0${String(info.turn)}`;
    if (captured.has(key)) return;
    captured.add(key);
    const dshHome = resolveDshHome2();
    const previous = await latestSnapshotBefore(dshHome, info.id, info.turn);
    await captureWorkspace(dshHome, info.id, info.turn, info.cwd, limits, previous, signal);
    await pruneSnapshots(dshHome, info.id, limits);
  }
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
    const sessionId = String(session.header.id);
    if (parsed.kind === "plan") {
      const preview = await previewRevert(session, sessionId, plan, recorder, limits);
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
    let revert;
    try {
      revert = await revertFiles(session, sessionId, plan, recorder, limits, log);
    } catch (error) {
      const detail = messageOf(error);
      log.warn(`rewind: file revert failed: ${detail}`);
      revert = {
        restored: 0,
        removed: 0,
        unrestorable: [{ path: "(all)", reason: detail }],
        coverage: "none",
        coverageReason: "revertFailed"
      };
    }
    let sourceEventSeq;
    try {
      const replacement = session.append("user/message", placeholderData(), {
        surfaceOp: { op: "replace", startSeq: SessionSeq(plan.startSeq), endSeq: SessionSeq(plan.endSeq) },
        sourceEventSeqs: plan.shadowedSeqs.map((seq) => SessionSeq(seq))
      });
      sourceEventSeq = replacement.seq;
    } catch (error) {
      const detail = messageOf(error);
      log.warn(`rewind: replacement rejected: ${detail}`);
      return { kind: "error", text: coded("rewind.host.rejected", void 0, detail) };
    }
    recorder.forget(sessionId, plan.turns);
    try {
      await dropSnapshots(resolveDshHome2(), sessionId, plan.turns);
    } catch (error) {
      log.warn(`rewind: snapshot cleanup failed: ${messageOf(error)}`);
    }
    return {
      kind: "success",
      // The recalled text travels WITH the result, so the composer gets it
      // exactly once — a durable projection would replay it on every reload.
      // The file revert's tally rides the same payload; see `coded`.
      text: coded("rewind.host.done", { n: parsed.n }, void 0, {
        prompt: plan.prompt,
        files: revert
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
function positive(value, fallback) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}
function sessionOfExec(exec) {
  const agent = exec?.agent;
  const session = agent?.session;
  return typeof session === "object" && session !== null ? session : void 0;
}
function sessionInfoOfExec(exec) {
  const session = sessionOfExec(exec);
  if (session === void 0 || session.ownEvents === void 0) return void 0;
  const id = session.header?.id;
  if (typeof id !== "string" || id === "") return void 0;
  const raw = session.header?.cwd;
  const cwd = typeof raw === "string" && raw !== "" ? raw : void 0;
  const seq = typeof session.seq === "number" ? session.seq : Number.MAX_SAFE_INTEGER;
  try {
    const turn = turnAt(session.ownEvents(), seq);
    return turn === null ? void 0 : { id, cwd, turn };
  } catch {
    return void 0;
  }
}
function seqOfExec(exec) {
  const seq = sessionOfExec(exec)?.seq;
  return typeof seq === "number" && Number.isSafeInteger(seq) ? seq : 0;
}
function signalOfExec(exec) {
  const signal = exec?.signal;
  return typeof signal === "object" && signal !== null && "aborted" in signal ? signal : void 0;
}
function planPaths(sessionId, turns, recorder) {
  const firstByPath = /* @__PURE__ */ new Map();
  for (const change of recorder.changesForTurns(sessionId, turns)) {
    if (!firstByPath.has(change.path)) firstByPath.set(change.path, change);
  }
  return { targets: [...firstByPath.values()], failures: recorder.failuresForTurns(sessionId, turns) };
}
function mergeTargets(sessionId, turns, recorder, diff) {
  const { targets: recorded, failures } = planPaths(sessionId, turns, recorder);
  const missed = [];
  const byPath = /* @__PURE__ */ new Map();
  if (diff !== void 0) {
    for (const target of diff.restore) byPath.set(pathKey(target.path), target);
    for (const path of diff.missing) {
      missed.push({ path, reason: "its before-image is no longer in the snapshot store" });
    }
    for (const path of diff.uncapturedChanged) {
      missed.push({ path, reason: "its earlier content was never kept (too large, unreadable, or a link)" });
    }
  }
  for (const change of recorded) {
    if (diff !== void 0 && diff.coveredOf(change.path)) continue;
    const key = pathKey(change.path);
    if (byPath.has(key)) continue;
    byPath.set(key, { path: change.path, before: change.before });
  }
  for (const failure of failures) {
    if (byPath.has(pathKey(failure.path))) continue;
    if (diff !== void 0 && diff.coveredOf(failure.path)) continue;
    missed.push({ path: failure.path, reason: failure.reason });
  }
  return { targets: [...byPath.values()], missed };
}
function writingToolsInRange(session, startSeq, endSeq) {
  const names = /* @__PURE__ */ new Set();
  for (let seq = startSeq; seq <= endSeq; seq += 1) {
    const event = session.eventAt(seq);
    if (event === void 0 || event.type !== "tool/call") continue;
    const name2 = event.data?.name;
    if (typeof name2 !== "string" || name2 === "") continue;
    if (READ_ONLY_TOOLS.has(name2)) continue;
    names.add(name2);
  }
  return [...names];
}
function coverageOf(session, plan, snapshot) {
  const tools = writingToolsInRange(session, plan.startSeq, plan.endSeq);
  const blind = tools.filter((tool) => !RECORDER_TOOLS.has(tool));
  if (blind.length === 0) return { coverage: "full", ...tools.length === 0 ? {} : { tools } };
  if (snapshot === void 0) return { coverage: "none", reason: "noSnapshot", tools: blind };
  if (snapshot.complete) return { coverage: "full", tools };
  return { coverage: "partial", reason: snapshot.reason ?? "incomplete", tools: blind };
}
async function snapshotDiff(sessionId, plan, limits) {
  const dshHome = resolveDshHome2();
  const first = plan.turns[0];
  const snapshot = first === void 0 ? void 0 : await readSnapshot(dshHome, sessionId, first);
  const diff = snapshot === void 0 ? void 0 : await diffWorkspace(snapshot, dshHome, limits);
  return { snapshot, diff };
}
async function previewRevert(session, sessionId, plan, recorder, limits) {
  const { snapshot, diff } = await snapshotDiff(sessionId, plan, limits);
  const { targets, missed } = mergeTargets(sessionId, plan.turns, recorder, diff);
  const restore = [];
  const remove = [];
  for (const target of targets) {
    const current = await captureBefore(target.path);
    const now = current.kind === "captured" ? current.before : void 0;
    const nowText = textOf(now);
    const nextText = textOf(target.before);
    if (target.before === null) {
      remove.push({
        path: target.path,
        action: "remove",
        ...nowText === void 0 ? {} : { current: nowText }
      });
      continue;
    }
    restore.push({
      path: target.path,
      action: "restore",
      ...nowText === void 0 ? {} : { current: nowText },
      ...nextText === void 0 ? {} : { next: nextText }
    });
  }
  const cover = coverageOf(session, plan, snapshot);
  return {
    restore,
    remove,
    unrestorable: missed,
    coverage: cover.coverage,
    ...cover.reason === void 0 ? {} : { coverageReason: cover.reason },
    ...cover.tools === void 0 ? {} : { tools: cover.tools }
  };
}
async function revertFiles(session, sessionId, plan, recorder, limits, log) {
  const dshHome = resolveDshHome2();
  const { snapshot, diff } = await snapshotDiff(sessionId, plan, limits);
  const { targets, missed } = mergeTargets(sessionId, plan.turns, recorder, diff);
  const dir = quarantineRoot(dshHome, sessionId);
  const now = Date.now();
  const unrestorable = [...missed];
  let restored = 0;
  let removed = 0;
  for (const target of targets) {
    const outcome = await restoreOne({ path: target.path, before: target.before }, dir, now, limits.maxFileBytes);
    if (outcome.kind === "restored") restored += 1;
    else if (outcome.kind === "removed") removed += 1;
    else {
      unrestorable.push({ path: target.path, reason: outcome.reason ?? "unknown" });
      log.warn(`rewind: could not restore ${target.path}: ${outcome.reason ?? "unknown"}`);
    }
  }
  const cover = coverageOf(session, plan, snapshot);
  return {
    restored,
    removed,
    unrestorable,
    coverage: cover.coverage,
    ...cover.reason === void 0 ? {} : { coverageReason: cover.reason },
    ...cover.tools === void 0 ? {} : { tools: cover.tools }
  };
}
export {
  Config,
  apply,
  inject,
  name
};
