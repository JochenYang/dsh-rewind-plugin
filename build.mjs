#!/usr/bin/env node
// Builds the rewind plugin's two halves: the host half (the /rewind command and
// the rewindAnchors projection, plus the quarantine routes) and the browser half
// (the composer prefill, the per-message icon and the settings page).
//
// `zod` is marked external: the projection schema type the kernel's own
// `dsh-session-projection` service declares IS zod, and that service resolves its
// own copy at load time. Bundling a second copy would ship ~750 KB of a library
// the framework already owns, and two zod instances would make the schema objects
// foreign to the registry.
//
// `esbuild` is a devDependency of this package, so the build resolves out of this
// project's own node_modules.
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDual } from './scripts/build-lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))

await buildDual(here, '@jochenyang/dsh-rewind-plugin', { extra: [/^zod(\/|$)/] })
