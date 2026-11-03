/**
 * The coverage verdict: the sentence a user acts on.
 *
 * A wrong `full` is the failure this whole feature exists to prevent — the plugin
 * reporting a clean revert over a range whose files it could not restore — so the
 * verdict is tested directly rather than only through a recall. `coverageOf` is a
 * pure function over a session's tool calls and one snapshot, which is why it lives
 * in its own module.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { Session } from '@deepseek-ai/dsh-session'
import { coverageOf, writingToolsInRange } from '../src/coverage.ts'
import type { TreeSnapshot } from '../src/trees.ts'

/** A session with one tool call per name, in order, plus a user prompt. */
function sessionWith(tools: readonly string[]): Session {
  const target = Session.create('coverage-session', undefined, {
    version: 4,
    id: 'coverage-session',
    createdAt: Date.now(),
    isSeeded: false,
    cwd: '/work',
  })
  target.append('turn/start', { turn: 1 })
  target.append('step/start', { turn: 1, step: 1 })
  target.append('user/message', {
    id: 'u1', role: 'user', content: [{ type: 'text', text: 'go' }], source: { kind: 'user' },
  }, { surfaceOp: 'append' })
  for (const [index, name] of tools.entries()) {
    target.append('tool/call', { turn: 1, step: 1, callId: `c${String(index)}`, name, arguments: '{}' })
  }
  target.append('assistant/message', {
    turn: 1,
    step: 1,
    message: {
      id: 'a1',
      role: 'assistant',
      content: [{ type: 'text', text: 'ok' }],
      source: { kind: 'model', provider: 'p', model: 'm' },
    },
  }, { surfaceOp: 'append' })
  target.append('step/end', { turn: 1, step: 1 })
  target.append('turn/end', { turn: 1 })
  return target
}

/** The whole session, as the range a recall would cut. */
function wholeRange(target: Session): { startSeq: number, endSeq: number } {
  // Probed rather than assumed: the log starts at seq 0 and is contiguous, but the
  // Session type publishes no length, and a wrong end would silently test an empty
  // range — the failure mode where a coverage test passes because it looked at
  // nothing.
  let end = 0
  while (target.eventAt(end) !== undefined) end += 1
  return { startSeq: 0, endSeq: end - 1 }
}

/** A snapshot that covered the whole tree. */
const complete: TreeSnapshot = {
  v: 1,
  sessionId: 'coverage-session',
  turn: 1,
  at: Date.now(),
  root: '/work',
  complete: true,
  entries: {},
  uncaptured: {},
}

test('a recorder that trimmed inside the range cannot be reported as full', () => {
  // THE DEFECT this pins: the recorder's history is bounded and trimming drops the
  // oldest before-images, but nothing told the recall — so a range whose files had
  // been trimmed still answered `full`, a restore that reports success while leaving
  // files untouched.
  const target = sessionWith(['write'])
  const range = wholeRange(target)
  const verdict = coverageOf(target, range, complete, range.startSeq)
  assert.equal(verdict.coverage, 'partial', 'a dropped before-image is not full coverage')
  assert.equal(verdict.reason, 'recorderTrimmed', 'and the reason names the trim')
})

test('a trim that stopped before the range does not make it partial', () => {
  // Trimming drops from the OLDEST end, so a dropped seq below the range's start
  // says nothing about the range: the before-images it needs are all still there.
  const target = sessionWith(['write'])
  const range = wholeRange(target)
  const verdict = coverageOf(target, range, complete, range.startSeq - 1)
  assert.equal(verdict.coverage, 'full', 'the range kept its before-images')
  assert.equal(verdict.reason, undefined)
})

test('no trim at all leaves the verdict alone', () => {
  const target = sessionWith(['write'])
  assert.equal(coverageOf(target, wholeRange(target), complete).coverage, 'full')
})

test('a range of recorder-visible tools needs no snapshot', () => {
  const target = sessionWith(['write', 'edit'])
  const verdict = coverageOf(target, wholeRange(target), undefined)
  assert.equal(verdict.coverage, 'full', 'the waterfall saw every write')
})

test('a blind tool with no snapshot is `none`, and names the tool', () => {
  const target = sessionWith(['pwsh'])
  const verdict = coverageOf(target, wholeRange(target), undefined)
  assert.equal(verdict.coverage, 'none')
  assert.equal(verdict.reason, 'noSnapshot')
  assert.deepEqual(verdict.tools, ['pwsh'])
})

test('a blind tool covered by a complete snapshot is `full`', () => {
  const target = sessionWith(['pwsh'])
  const verdict = coverageOf(target, wholeRange(target), complete)
  assert.equal(verdict.coverage, 'full')
  assert.deepEqual(verdict.tools, ['pwsh'])
})

test('an incomplete snapshot makes a blind tool partial, with the snapshot\'s reason', () => {
  const target = sessionWith(['pwsh'])
  const verdict = coverageOf(target, wholeRange(target), { ...complete, complete: false, reason: 'timeout' })
  assert.equal(verdict.coverage, 'partial')
  assert.equal(verdict.reason, 'timeout')
  assert.deepEqual(verdict.tools, ['pwsh'])
})

test('reading tools are not writing tools, so they never make a range partial', () => {
  const target = sessionWith(['read', 'grep', 'todo_write'])
  const range = wholeRange(target)
  assert.deepEqual(writingToolsInRange(target, range.startSeq, range.endSeq), [])
  assert.equal(coverageOf(target, range, undefined).coverage, 'full')
})
