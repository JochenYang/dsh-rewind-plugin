/**
 * How much of a recalled range's file changes a recall can actually see.
 *
 * Kept out of `./index.ts` and free of cordis and of any live session object, so
 * the verdict is unit-testable: it is the sentence a user acts on, and a wrong
 * `full` is the failure this whole feature exists to prevent — the plugin
 * reporting a clean revert over a range whose files it could not restore.
 *
 * @module dsh-rewind-plugin/coverage
 */

import type { EventLike, SessionLike } from './cut.ts'
import type { TreeSnapshot } from './trees.ts'
import type { RevertCoverage } from './wire.ts'

/**
 * Tools whose writes the recorder sees exactly, so a range that ran only these
 * needs no workspace snapshot to be fully covered.
 */
const RECORDER_TOOLS = new Set(['write', 'edit', 'str_replace_editor'])

/**
 * Tools that cannot touch the workspace at all, so they never trigger a snapshot.
 *
 * This list is deliberately short and only holds readers: a tool wrongly listed
 * here would silently lose its changes from a recall, while a tool wrongly left
 * out only costs one walk. An unknown tool therefore errs toward taking a
 * snapshot, which is the safe direction.
 */
export const READ_ONLY_TOOLS = new Set([
  'read', 'read_image', 'glob', 'grep', 'web_search', 'web_fetch',
  'ask_user_question', 'todo_write', 'job_list', 'job_output',
  'skill', 'present', 'memory_recall', 'session_search', 'session_event_search',
])

/**
 * The tool names that ran inside one recalled range and can write files.
 *
 * Read from the session log, which is the durable record: an in-memory note
 * would be empty exactly when it matters (a restarted kernel child), and the
 * whole point of this list is to tell the user when a recall cannot see what a
 * range did.
 *
 * @param session - the session being recalled.
 * @param startSeq - first surface sequence of the range.
 * @param endSeq - last surface sequence of the range.
 * @returns the distinct writing tool names, in first-seen order.
 */
export function writingToolsInRange(session: SessionLike, startSeq: number, endSeq: number): string[] {
  const names = new Set<string>()
  for (let seq = startSeq; seq <= endSeq; seq += 1) {
    const event: EventLike | undefined = session.eventAt(seq)
    if (event === undefined || event.type !== 'tool/call') continue
    const name = (event.data as { name?: unknown } | null)?.name
    if (typeof name !== 'string' || name === '') continue
    if (READ_ONLY_TOOLS.has(name)) continue
    names.add(name)
  }
  return [...names]
}

/**
 * How much of a range's file changes a recall can see, and why not.
 *
 * `full` means every path the range could have changed is accounted for: either
 * the workspace snapshot covered the whole tree, or the only tools that ran are
 * ones the recorder sees exactly. `none` means a tool that writes through its own
 * handle ran and there is no snapshot for the range's first turn — the case that
 * used to be reported as an unqualified success.
 *
 * @param session - the session being recalled.
 * @param plan - the computed cut.
 * @param snapshot - the range's first turn's snapshot, when there is one.
 * @param trimmedThrough - the newest `seq` the recorder's trim has discarded.
 * @returns the coverage verdict, plus the tools that make it partial.
 */
export function coverageOf(
  session: SessionLike,
  plan: { readonly startSeq: number, readonly endSeq: number },
  snapshot: TreeSnapshot | undefined,
  trimmedThrough = -1,
): { readonly coverage: RevertCoverage, readonly reason?: string, readonly tools?: readonly string[] } {
  const tools = writingToolsInRange(session, plan.startSeq, plan.endSeq)
  // A trimmed recorder lost before-images for the oldest writes it had seen. The
  // range cannot be fully restored even when every tool in it is one the recorder
  // understands, and answering `full` would be exactly the "quietly leaves things
  // out" failure the preview documents exist to prevent.
  if (trimmedThrough >= plan.startSeq) {
    return { coverage: 'partial', reason: 'recorderTrimmed', ...(tools.length === 0 ? {} : { tools }) }
  }
  const blind = tools.filter((tool) => !RECORDER_TOOLS.has(tool))
  if (blind.length === 0) return { coverage: 'full', ...(tools.length === 0 ? {} : { tools }) }
  if (snapshot === undefined) return { coverage: 'none', reason: 'noSnapshot', tools: blind }
  if (snapshot.complete) return { coverage: 'full', tools }
  return { coverage: 'partial', reason: snapshot.reason ?? 'incomplete', tools: blind }
}
