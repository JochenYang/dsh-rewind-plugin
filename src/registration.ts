/**
 * Registering and releasing a session-projection unit across kernel lines.
 *
 * `ctx.sessionProjections.register` changed shape: up to `0.2.1` it returns the
 * disposer itself, and from `0.2.2-rc.1` it returns a `Promise<ProjectionHandle>`
 * whose `dispose()` is the release. This package declares no `@deepseek-ai/dsh-*`
 * peer (the installer refuses an install whose peer does not match the running
 * runtime), so it has to work on both — which means reading the answer's shape at
 * run time rather than trusting the declaration the tree compiles against.
 *
 * The promise branch also carries a rejection handler. Nothing awaits the
 * registration (a cordis effect body is synchronous), so a failure on the newer
 * line would otherwise surface as an unhandled rejection — which Node turns into a
 * crash under its default policy — instead of a warning the user can read.
 *
 * Kept out of `./index.ts` so both branches are testable without a kernel.
 *
 * @module dsh-rewind-plugin/registration
 */

/** The handle a `0.2.2-rc.1`-or-later registry resolves its registration to. */
export interface ProjectionHandleLike {
  /** Release this registration. */
  dispose(): unknown
}

/** Where a failed registration is reported. */
export interface RegistrationLog {
  /** Record a warning; the plugin is not failed by one. */
  warn(message: string): void
}

/** Whether an answer is the newer line's awaitable handle. */
function isThenable(value: unknown): value is PromiseLike<ProjectionHandleLike> {
  return value !== null
    && value !== undefined
    && typeof (value as { then?: unknown }).then === 'function'
}

/**
 * Register a projection unit and return the disposer a cordis effect needs.
 *
 * The returned disposer is synchronous on both lines. On the newer one it releases
 * through the handle's own `dispose`, one microtask after the registration settles.
 *
 * @param register - the call that registers the unit.
 * @param log - receives a warning when a newer-line registration rejects.
 * @returns the disposer for the effect that owns this registration.
 */
export function registerProjection(register: () => unknown, log: RegistrationLog): () => void {
  const registered = register()

  // Up to 0.2.1 the answer IS the disposer.
  if (typeof registered === 'function') {
    return () => { (registered as () => void)() }
  }

  // From 0.2.2-rc.1 the answer is a promise of a handle. Both handlers are attached
  // HERE, at registration, so a rejection is reported when it happens.
  if (isThenable(registered)) {
    const settled = Promise.resolve(registered).then(
      (handle) => handle,
      (error: unknown) => {
        log.warn(`rewind: projection registration failed: ${error instanceof Error ? error.message : String(error)}`)
        return undefined
      },
    )
    return () => { void settled.then((handle) => { handle?.dispose() }) }
  }

  // Neither shape: a stub, or a line that returned nothing. There is nothing to
  // release, and disposal is not a place to fail — the plugin is going away anyway.
  return () => {}
}
