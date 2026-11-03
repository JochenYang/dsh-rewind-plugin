/**
 * Tests for the quarantine manager.
 *
 * Two properties carry the weight here, and both are the kind a UI cannot check:
 *
 *   1. a listing identifies its entries — a slot's directory name is a timestamp
 *      and a hash, so without the manifest a user sees `replaced` and cannot tell
 *      which file it came from, let alone whether it is safe to drop;
 *   2. a purge cannot leave the quarantine. The request carries NAMES, and
 *      `isSafeSegment` is what makes that safe: `.`, `..`, a separator, a drive
 *      prefix and a NUL are refused rather than normalised, because normalising is
 *      how a traversal gets smuggled through.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isSafeSegment, listQuarantine, purgeQuarantine } from '../src/quarantine.ts'
import { MANIFEST_NAME, quarantineRoot, restoreOne, restoreTargets } from '../src/snapshots.ts'

/** A scratch `$DSH_HOME`. */
function home(): string {
  return mkdtempSync(join(tmpdir(), 'rewind-quar-'))
}

test('a listing names the file each slot came from', async () => {
  const dshHome = home()
  const work = mkdtempSync(join(tmpdir(), 'rewind-work-'))
  const file = join(work, 'config.ts')
  writeFileSync(file, 'BEFORE')

  // A real restore, so the manifest under test is the one the feature writes.
  const outcome = await restoreOne({ path: file, before: Buffer.from('BEFORE') }, quarantineRoot(dshHome, 'session-a'), 1)
  writeFileSync(file, 'AFTER')

  const listing = await listQuarantine(dshHome)
  assert.equal(listing.entries, 1)
  assert.equal(listing.groups.length, 1)
  assert.equal(listing.groups[0].sessionId, 'session-a')
  const entry = listing.groups[0].entries[0]
  assert.equal(entry.kind, 'replaced')
  assert.equal(entry.originalPath, file, 'the original path is what makes a row actionable')
  assert.equal(entry.at, 1)
  assert.ok(entry.bytes > 0, 'the size is what a user reclaims')
  assert.equal(outcome.kind, 'restored')
  await rm(dshHome, { recursive: true, force: true })
  await rm(work, { recursive: true, force: true })
})

test('a slot with no readable manifest is listed as unknown, not hidden', async () => {
  // An entry a user cannot see is an entry they cannot reclaim, which defeats the
  // point of keeping it. A missing manifest is reported as unknown origin.
  const dshHome = home()
  const slotDir = join(quarantineRoot(dshHome, 'session-b'), '2026-01-01T00-00-00-000Z-1')
  mkdirSync(slotDir, { recursive: true })
  writeFileSync(join(slotDir, 'replaced'), 'content')

  const listing = await listQuarantine(dshHome)
  assert.equal(listing.entries, 1)
  assert.equal(listing.groups[0].entries[0].kind, 'unknown')
  assert.equal(listing.groups[0].entries[0].originalPath, undefined)
  assert.ok(listing.bytes > 0, 'an unreadable manifest still reports its size')
  await rm(dshHome, { recursive: true, force: true })
})

test('an empty quarantine lists as empty rather than failing', async () => {
  const listing = await listQuarantine(home()).then(async (value) => {
    return value
  })
  assert.deepEqual(listing, { groups: [], entries: 0, bytes: 0 })
})

test('purge removes exactly the named slots', async () => {
  const dshHome = home()
  const root = quarantineRoot(dshHome, 'session-c')
  for (const slot of ['slot-1', 'slot-2', 'slot-3']) {
    mkdirSync(join(root, slot), { recursive: true })
    writeFileSync(join(root, slot, 'replaced'), slot)
  }
  const result = await purgeQuarantine(dshHome, [{ sessionId: 'session-c', slot: 'slot-2' }])
  assert.deepEqual({ removed: result.removed, failed: result.failed }, { removed: 1, failed: [] })
  const left = await listQuarantine(dshHome)
  assert.deepEqual(left.groups[0].entries.map((entry) => entry.slot).sort(), ['slot-1', 'slot-3'])
  await rm(dshHome, { recursive: true, force: true })
})

test('purging an already-gone slot is not a failure', async () => {
  // The user asked for it to be absent, and it is. Reporting an error would make
  // a page that has already been cleared look broken.
  const result = await purgeQuarantine(home(), [{ sessionId: 'nope', slot: 'gone' }])
  assert.equal(result.removed, 1)
  assert.deepEqual(result.failed, [])
})

test('a traversal segment is refused, and nothing is deleted', async () => {
  const dshHome = home()
  // A file OUTSIDE the quarantine, as the thing a traversal would reach.
  const outside = join(dshHome, 'precious.txt')
  writeFileSync(outside, 'do not delete')

  const attempts = [
    { sessionId: '..', slot: 'x' },
    { sessionId: 'a', slot: '..' },
    { sessionId: '../../..', slot: 'x' },
    { sessionId: 'a', slot: 'x/../../..' },
    { sessionId: 'a', slot: '..\\..' },
    { sessionId: 'C:', slot: 'x' },
    { sessionId: 'a', slot: 'C:\\Windows' },
    { sessionId: '.', slot: '.' },
  ]
  const result = await purgeQuarantine(dshHome, attempts)
  assert.equal(result.removed, 0, 'no unsafe target may be removed')
  assert.equal(result.failed.length, attempts.length, 'each refusal is reported')
  assert.equal(readFileSync(outside, 'utf8'), 'do not delete', 'the file outside survived')
  await rm(dshHome, { recursive: true, force: true })
})

test('isSafeSegment admits an ordinary name and nothing that can walk out', () => {
  assert.equal(isSafeSegment('2026-01-01T00-00-00-000Z-123'), true)
  assert.equal(isSafeSegment('session-a1b2c3'), true)
  for (const bad of ['', '.', '..', 'a/b', 'a\\b', 'C:', 'C:\\x', '/abs', '\0', 'a\0b']) {
    assert.equal(isSafeSegment(bad), false, `must refuse ${JSON.stringify(bad)}`)
  }
})

test('a purge by session keeps the other sessions intact', async () => {
  const dshHome = home()
  for (const session of ['one', 'two']) {
    const slot = join(quarantineRoot(dshHome, session), 'slot')
    mkdirSync(slot, { recursive: true })
    writeFileSync(join(slot, MANIFEST_NAME), JSON.stringify({ originalPath: `/x/${session}.ts`, kind: 'replaced', at: 1 }))
    writeFileSync(join(slot, 'replaced'), session)
  }
  const listing = await listQuarantine(dshHome)
  const target = listing.groups.find((group) => group.sessionId === 'one')
  assert.ok(target !== undefined)
  const result = await purgeQuarantine(dshHome, target.entries.map((entry) => ({ sessionId: 'one', slot: entry.slot })))
  assert.equal(result.removed, 1)

  const after = await listQuarantine(dshHome)
  assert.deepEqual(after.groups.map((group) => group.sessionId), ['two'])
  await rm(dshHome, { recursive: true, force: true })
})

test('two restores in the same millisecond never share a slot', async () => {
  // THE DEFECT this pins: a slot name was `stamp-hash`, and the stamp is only
  // millisecond-accurate while the hash is a 32-bit fold that `Math.abs` maps onto
  // one value for `h` and `-h`. Anything restored into the same slot overwrote the
  // previous quarantined copy without a trace — the safety net losing the thing it
  // exists to keep. Restoring one path twice is the deterministic case: same path,
  // same hash, same millisecond.
  const dshHome = home()
  const work = mkdtempSync(join(tmpdir(), 'rewind-work-'))
  try {
    const root = quarantineRoot(dshHome, 'session-a')
    const file = join(work, 'one.ts')
    writeFileSync(file, 'AFTER-FIRST')

    const now = 1_700_000_000_000
    const a = await restoreOne({ path: file, before: Buffer.from('BEFORE-ONE') }, root, now)
    // The restore put BEFORE-ONE back, so the second restore displaces different
    // bytes: one slot would silently lose the first copy.
    writeFileSync(file, 'AFTER-SECOND')
    const b = await restoreOne({ path: file, before: Buffer.from('BEFORE-TWO') }, root, now)

    assert.equal(a.kind, 'restored')
    assert.equal(b.kind, 'restored')
    assert.notEqual(a.slot, b.slot, 'one millisecond and one path is still not one slot')

    // Both displaced copies survive, which is what the collision destroyed.
    const listing = await listQuarantine(dshHome)
    assert.equal(listing.entries, 2, 'both displaced files are listed')
    const displaced = listing.groups[0].entries.map((entry) => readFileSync(join(root, entry.slot, 'replaced'), 'utf8'))
    assert.deepEqual(displaced.sort(), ['AFTER-FIRST', 'AFTER-SECOND'])
  } finally {
    await rm(dshHome, { recursive: true, force: true })
    await rm(work, { recursive: true, force: true })
  }
})

test('an aborted restore stops writing and names what it never reached', async () => {
  // THE DEFECT this pins: the participant deadline only stopped WAITING. The restore
  // kept writing files after the recall had already answered "not restored", so the
  // user's obvious next action — recall again — raced it on the same paths.
  const dshHome = home()
  const work = mkdtempSync(join(tmpdir(), 'rewind-work-'))
  try {
    const root = quarantineRoot(dshHome, 'session-a')
    const first = join(work, 'first.ts')
    const second = join(work, 'second.ts')
    writeFileSync(first, 'AFTER-ONE')
    writeFileSync(second, 'AFTER-TWO')

    const controller = new AbortController()
    controller.abort()
    const warned: string[] = []
    const result = await restoreTargets(
      [
        { path: first, before: Buffer.from('BEFORE-ONE') },
        { path: second, before: Buffer.from('BEFORE-TWO') },
      ],
      root,
      1,
      1024,
      { warn: (message) => { warned.push(message) } },
      controller.signal,
    )

    assert.equal(result.restored, 0, 'an aborted restore restores nothing')
    assert.deepEqual(
      result.unrestorable.map((entry) => entry.reason),
      ['cancelled', 'cancelled'],
      'and every file it never reached is named, not dropped from the report',
    )
    assert.equal(readFileSync(first, 'utf8'), 'AFTER-ONE', 'the workspace is untouched')
    assert.equal(readFileSync(second, 'utf8'), 'AFTER-TWO')
    assert.deepEqual(warned, [], 'a cancellation is not a failure to warn about')
  } finally {
    await rm(dshHome, { recursive: true, force: true })
    await rm(work, { recursive: true, force: true })
  }
})
