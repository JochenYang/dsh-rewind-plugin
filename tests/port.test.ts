/**
 * Guards for this package as a STANDALONE plugin rather than a plugin of the
 * `@dsh-app` suite it was ported from.
 *
 * Each check below covers a coupling that fails QUIETLY when it drifts:
 *
 *   - `ctx.slots.inject` on a key nobody declares runs no callback and reports
 *     nothing, so a page aimed at a suite-only slot is simply missing;
 *   - a bundle patch whose `name` differs from the package is skipped with a
 *     warning, so the row never mounts and nothing looks broken;
 *   - every `@deepseek-ai/dsh-*` peerDependency is compared against the running
 *     runtime version at install time and refuses the install on a mismatch;
 *   - a missing `exports["./client"]` makes the client loader throw, and a
 *     package without `dsh.bundle` is not a bundle to the installer at all.
 *
 * These read the tree rather than importing it, which is what lets them run
 * without a browser and without the framework's browser packages.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  readonly name: string
  readonly files?: readonly string[]
  readonly exports?: Readonly<Record<string, string>>
  readonly peerDependencies?: Readonly<Record<string, string>>
  readonly dsh?: {
    readonly bundle?: { readonly patch?: string }
    readonly client?: { readonly platform?: string, readonly inject?: readonly string[] }
  }
}

/** Every file under `dir`, as `[path relative to the package root, text]`. */
function sourceFiles(dir: string): [string, string][] {
  const out: [string, string][] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else out.push([full.slice(root.length), readFileSync(full, 'utf8')])
  }
  return out
}

test('no source file reaches back into the dsh-app suite', () => {
  const offenders = sourceFiles(join(root, 'src'))
    .filter(([, text]) => /@dsh-app\/|dsh-app-|settings\.dsh-app/.test(text))
    .map(([path]) => path)
  assert.deepEqual(
    offenders,
    [],
    `a suite-only name cannot resolve on stock DSH: ${offenders.join(', ')}`,
  )
})

test('the bundle patch mounts the package it ships in', () => {
  // Comments are stripped first: this file explains itself at length, and a
  // `name:` inside prose must not be mistaken for the row's.
  const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n')
  const mounted = [...patch.matchAll(/^\s*name:\s*['"]?([^'"\s]+)['"]?\s*$/gm)].map((match) => match[1])
  assert.deepEqual(
    mounted,
    [manifest.name],
    'the patch name is the package name a profile resolves the row through',
  )
})

test('the quarantine page registers into the settings shell’s own seat', () => {
  const client = readFileSync(join(root, 'src', 'client.ts'), 'utf8')
  // `settings.section` is declared by dsh-client-ui-settings, which every
  // settings section already depends on. The suite's own maintenance tab is not
  // declared anywhere on stock DSH.
  assert.match(client, /ctx\.slots\.inject\('settings\.section'/)
  assert.match(client, /name: 'settings\.section'/)
  assert.doesNotMatch(client, /MaintenanceTabOwnerProps|settings\.dsh-app/)
})

test('no @deepseek-ai/dsh-* peer pins the install to one runtime version', () => {
  const gated = Object.keys(manifest.peerDependencies ?? {})
    .filter((name) => name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-'))
  assert.deepEqual(
    gated,
    [],
    'the installer compares these against the running runtime version and refuses the install; '
      + 'this plugin needs nothing installed, so it declares none of them',
  )
})

test('the manifest carries what the installer and the client loader read', () => {
  assert.equal(manifest.dsh?.bundle?.patch, './cordis.patch.yml', 'without dsh.bundle the installer sees no bundle')
  assert.equal(manifest.dsh?.client?.platform, 'web', 'only "web" is scanned on the browser side')
  assert.equal(manifest.exports?.['./client'], './lib/client.js', 'a missing ./client export throws at client load')
  assert.ok(manifest.files?.includes('lib'), 'the built halves must be published')
  assert.ok(manifest.files?.includes('cordis.patch.yml'), 'the patch must be published')

  // The page's slot contract and the locale namespace merge both come from
  // these two, so the client graph edge has to name them.
  const inject = manifest.dsh?.client?.inject ?? []
  for (const pkg of ['@deepseek-ai/dsh-client-ui-settings', '@deepseek-ai/dsh-client-ui-slots']) {
    assert.ok(inject.includes(pkg), `dsh.client.inject should name ${pkg}`)
  }
})
