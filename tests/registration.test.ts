/**
 * Registering and releasing a projection unit on either kernel line.
 *
 * The two lines disagree on what `ctx.sessionProjections.register` answers, and this
 * package declares no `@deepseek-ai/dsh-*` peer, so it must handle both. These tests
 * pin the branch the local type gate cannot see: the declaration installed here only
 * describes the older, synchronous disposer.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { registerProjection } from '../src/registration.ts'

const settle = (): Promise<void> => new Promise((resolve) => { setImmediate(resolve) })

/** A log that records warnings, for the rejection case. */
function warnings(): { lines: string[], log: { warn(message: string): void } } {
  const lines: string[] = []
  return { lines, log: { warn: (message) => { lines.push(message) } } }
}

test('up to 0.2.1 the registration answer IS the disposer, and is called', () => {
  const calls: string[] = []
  const { log } = warnings()
  const dispose = registerProjection(() => () => { calls.push('disposed') }, log)
  assert.deepEqual(calls, [], 'registration alone disposes nothing')
  dispose()
  assert.deepEqual(calls, ['disposed'], 'the disposer runs synchronously')
})

test('from 0.2.2-rc.1 the answer is an awaitable handle, and its dispose runs', async () => {
  const calls: string[] = []
  const { log } = warnings()
  const dispose = registerProjection(
    () => Promise.resolve({ dispose: () => { calls.push('handle') } }),
    log,
  )
  dispose()
  // The effect disposer is synchronous, so the release lands one microtask later;
  // it must still land without the caller awaiting anything.
  assert.deepEqual(calls, [], 'nothing has run yet')
  await settle()
  assert.deepEqual(calls, ['handle'], 'the handle disposes itself')
})

test('a rejected registration is warned about, not left unhandled', async () => {
  // Nothing awaits the registration, so without a handler here the rejection would
  // surface as an unhandled rejection — a process crash under Node's default policy.
  const { lines, log } = warnings()
  const dispose = registerProjection(() => Promise.reject(new Error('registry closed')), log)
  await settle()
  assert.match(lines.join('\n'), /projection registration failed/u)
  assert.match(lines.join('\n'), /registry closed/u)
  // Disposing a failed registration releases nothing and does not throw.
  assert.doesNotThrow(dispose)
})

test('an answer of neither shape releases nothing, and does not throw', () => {
  // A stub, or a line that returned nothing. Disposal is not a place to fail: the
  // plugin is going away either way.
  for (const nothing of [undefined, null, 0, 'disposer?', {}]) {
    const { log } = warnings()
    const dispose = registerProjection(() => nothing, log)
    assert.doesNotThrow(dispose)
  }
})
