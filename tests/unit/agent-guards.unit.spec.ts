// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { checkMcpCall, checkShellCommand } from '../../scripts/agent-hooks/policy.mjs'

const hooksDir = fileURLToPath(new URL('../../scripts/agent-hooks/', import.meta.url))

function runHook(script: string, tool: 'cursor' | 'claude', input: unknown, env = {}) {
  const result = spawnSync(process.execPath, [`${hooksDir}${script}`, `--tool=${tool}`], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, NEON_AGENT_BRANCH_IDS: '', ...env },
  })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

describe('shell guard', () => {
  it.each([
    ['rm -rf /', 'root delete'],
    ['rm -rf ~/', 'home delete with slash'],
    ['rm -r -f $HOME', 'split flags'],
    ['sudo rm -fr / --no-preserve-root', 'reordered flags'],
    ['git push --force origin main', 'force push'],
    ['git push -f', 'short force flag'],
    ['git push origin +main', 'force push via refspec'],
    ['git push origin feature/x -f', 'short force flag after the refspec'],
    ['git push -u origin main', 'push to main'],
    ['git push origin HEAD:main', 'push HEAD to main'],
    ['git push origin refs/heads/main', 'push to main by full ref'],
    ['git push --force-with-lease origin main', 'lease-protected push to main'],
    ['git push origin master', 'push to master'],
    ['git reset --hard origin/main', 'hard reset to remote'],
    ['psql -c "DROP TABLE users"', 'drop table'],
    ['psql "$DATABASE_URL" -c "truncate waitlist_signups"', 'truncate'],
    ['pnpm payload migrate:fresh', 'migrate:fresh'],
    ['pnpm payload migrate:down', 'migrate:down'],
    [
      'DATABASE_URL=postgresql://app:app@127.0.0.1:5432/app pnpm payload migrate:down',
      'migrate:down on the dev database',
    ],
    [
      'DATABASE_URL=postgresql://app:app@db.example.com:5432/app_test pnpm payload migrate:down',
      'migrate:down on a remote host',
    ],
    [
      'DATABASE_URL=postgresql://app:app@127.0.0.1:5432/app_test pnpm payload migrate:fresh && pnpm payload migrate:fresh',
      'a second, unscoped migrate:fresh after &&',
    ],
    [
      'DATABASE_URL=postgresql://app:app@127.0.0.1:5432/app_test pnpm payload migrate:down; pnpm payload migrate:down',
      'a second, unscoped migrate:down after ;',
    ],
    [
      'DATABASE_URL=postgresql://app:app@127.0.0.1:5432/app_test pnpm payload migrate:down\npnpm payload migrate:down',
      'a second migrate:down on a new line',
    ],
    [
      'DATABASE_URL=postgresql://app:app@127.0.0.1:5432/app_test pnpm payload migrate:down $(pnpm payload migrate:down)',
      'a second migrate:down in a subshell',
    ],
    [
      'export DATABASE_URL=postgresql://app:app@127.0.0.1:5432/app_test; pnpm payload migrate:fresh',
      'exported URL does not scope the next command',
    ],
    ['psql postgresql://u:p@ep-cool-123-pooler.eu-central-1.aws.neon.tech/neondb', 'Neon URL'],
    ['DATABASE_URL=postgres://u:p@ep-x.neon.tech/db pnpm seed', 'Neon URL in env prefix'],
    ['neonctl branches delete main', 'Neon CLI'],
    ['npx neon connection-string', 'Neon CLI via npx'],
    ['vercel --prod', 'prod deploy'],
    ['vercel deploy --prebuilt --prod', 'prod deploy with flags in between'],
    ['vercel promote dpl_123', 'promote'],
    ['vercel rollback', 'rollback'],
    ['pnpm dlx vercel env pull .env', 'env pull'],
    ['vercel env pull .env.local', 'env pull into a local file'],
    ['vercel pull --yes', 'pull project settings and env'],
    ['vercel env add DATABASE_URL production', 'env add'],
    ['ALLOW_REMOTE_DATABASE=1 pnpm create-admin a@b.c', 'remote database opt-in'],
    ['DATABASE_URI=$X ALLOW_REMOTE_DATABASE=1 pnpm dev', 'opt-in after another assignment'],
    ["export ALLOW_REMOTE_DATABASE='1'; pnpm backup:restore f", 'exported opt-in'],
    ['pnpm check && env ALLOW_REMOTE_DATABASE=1 pnpm seed', 'opt-in via env after &&'],
  ])('blocks %s (%s)', (command) => {
    expect(checkShellCommand(command).allowed).toBe(false)
  })

  it.each([
    'pnpm check',
    'pnpm test:int',
    'rm -rf node_modules .next',
    'rm -rf ./media/*',
    'git push -u origin agent/abc123',
    'git push origin feature/main-page',
    'git push origin main-fix',
    'git push --force-with-lease origin feature/x',
    'git reset --hard HEAD~1',
    'pnpm migrate:create add-tags',
    'DATABASE_URL=postgresql://app:app@127.0.0.1:5432/app_test pnpm payload migrate:down',
    'DATABASE_URL=postgresql://app:app@localhost:5433/app_test pnpm payload migrate:fresh',
    'DATABASE_URL=postgresql://agent@127.0.0.1:5432/app_wt1_test pnpm payload migrate:fresh',
    'DATABASE_URL=postgresql://app:app@127.0.0.1:5433/app_migr_021 PAYLOAD_DB_PUSH=false pnpm payload migrate:down',
    'psql postgresql://app:app@127.0.0.1:5432/app -c "select 1"',
    'vercel --help',
    'vercel deploy',
    'vercel env ls',
    'neonctl --help',
    'echo "neon lights" && grep -r vercel docs',
    'rg "drop shadow" src',
    'rg "ALLOW_REMOTE_DATABASE=1" docs',
    'pnpm create-admin a@example.com',
  ])('allows %s', (command) => {
    expect(checkShellCommand(command).allowed).toBe(true)
  })
})

describe('MCP guard', () => {
  const neon = (tool: string, input: unknown = {}, env = {}) =>
    checkMcpCall(
      { server: 'neon', url: 'https://mcp.neon.tech/mcp?readonly=true', tool, input },
      env,
    )
  const vercel = (tool: string) => checkMcpCall({ server: 'vercel', tool })

  it('blocks SQL on the default (production) branch when no branchId is given', () => {
    expect(neon('run_sql', { projectId: 'p', sql: 'select 1' }).allowed).toBe(false)
  })

  it('blocks SQL on a branch that is not allow-listed', () => {
    const verdict = neon('run_sql', { branchId: 'br-main' }, { NEON_AGENT_BRANCH_IDS: 'br-dev' })
    expect(verdict).toMatchObject({
      allowed: false,
      reason: expect.stringContaining('NEON_AGENT_BRANCH_IDS'),
    })
  })

  it('allows SQL on an allow-listed dev branch, also when tool_input is a JSON string', () => {
    const env = { NEON_AGENT_BRANCH_IDS: 'br-dev, br-preview' }
    expect(neon('run_sql', JSON.stringify({ branchId: 'br-preview' }), env).allowed).toBe(true)
    expect(neon('describe_table_schema', { branchId: 'br-dev' }, env).allowed).toBe(true)
  })

  it.each([
    'create_branch',
    'delete_project',
    'reset_from_parent',
    'complete_database_migration',
    'restore_snapshot',
    'some_future_tool',
  ])('blocks Neon write or unknown tool %s', (tool) => {
    expect(neon(tool).allowed).toBe(false)
  })

  it('blocks Neon tools that return credentials', () => {
    expect(neon('get_connection_string').allowed).toBe(false)
  })

  it.each(['list_projects', 'describe_project', 'list_branches', 'search', 'get_doc_resource'])(
    'allows Neon metadata tool %s',
    (tool) => {
      expect(neon(tool).allowed).toBe(true)
    },
  )

  it.each([
    'deploy_to_vercel',
    'create_deployment',
    'request_promote',
    'edit_project_env',
    'buy_domain',
    'delete_project',
    'get_project_env',
    'get_access_to_vercel_url',
  ])('blocks Vercel write or secret tool %s', (tool) => {
    expect(vercel(tool).allowed).toBe(false)
  })

  it.each([
    'list_deployments',
    'get_deployment',
    'get_runtime_logs',
    'search_vercel_documentation',
  ])('allows Vercel read tool %s', (tool) => {
    expect(vercel(tool).allowed).toBe(true)
  })

  it('recognizes a renamed Neon server by its URL', () => {
    expect(
      checkMcpCall({ server: 'db', url: 'https://mcp.neon.tech/mcp', tool: 'run_sql' }).allowed,
    ).toBe(false)
  })

  it('leaves other servers alone', () => {
    expect(checkMcpCall({ server: 'chrome-devtools', tool: 'evaluate_script' }).allowed).toBe(true)
  })
})

describe('hook scripts', () => {
  it('Cursor shell hook denies with JSON and exit 2', () => {
    const result = runHook('guard-shell.mjs', 'cursor', { command: 'git push --force' })
    expect(result.status).toBe(2)
    expect(JSON.parse(result.stdout)).toMatchObject({ permission: 'deny' })
  })

  it('Cursor shell hook allows with JSON and exit 0', () => {
    const result = runHook('guard-shell.mjs', 'cursor', { command: 'pnpm check' })
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({ permission: 'allow' })
  })

  it('Claude shell hook blocks with exit 2 and a reason on stderr', () => {
    const result = runHook('guard-shell.mjs', 'claude', {
      tool_input: { command: 'vercel --prod' },
    })
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('production deploys')
  })

  it('Cursor MCP hook denies production SQL', () => {
    const result = runHook('guard-mcp.mjs', 'cursor', {
      tool_name: 'run_sql',
      tool_input: JSON.stringify({ sql: 'select * from users' }),
      mcp_server_name: 'neon',
      mcp_server_url: 'https://mcp.neon.tech/mcp?readonly=true',
    })
    expect(result.status).toBe(2)
    expect(JSON.parse(result.stdout)).toMatchObject({ permission: 'deny' })
  })

  describe('Codex Stop hook (stop-check.mjs)', () => {
    // A fake `pnpm` first on PATH stands in for `pnpm check`.
    function withFakePnpm(exitCode: number) {
      const dir = mkdtempSync(path.join(tmpdir(), 'fake-pnpm-'))
      const bin = path.join(dir, 'pnpm')
      writeFileSync(bin, `#!/bin/sh\necho "check output on stdout"\nexit ${exitCode}\n`)
      chmodSync(bin, 0o755)
      return { PATH: `${dir}${path.delimiter}${process.env.PATH}` }
    }

    it('lets Codex finish when pnpm check passes, with nothing on stdout', () => {
      const result = runHook('stop-check.mjs', 'claude', {}, withFakePnpm(0))
      expect(result).toMatchObject({ status: 0, stdout: '' })
    })

    it('makes Codex continue (exit 2, reason on stderr) when pnpm check fails', () => {
      const result = runHook('stop-check.mjs', 'claude', {}, withFakePnpm(1))
      expect(result.status).toBe(2)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain('pnpm check failed')
      expect(result.stderr).toContain('check output on stdout')
    })

    it('does not loop: a turn already continued by Stop may finish', () => {
      const result = runHook(
        'stop-check.mjs',
        'claude',
        { stop_hook_active: true },
        withFakePnpm(1),
      )
      expect(result).toMatchObject({ status: 0, stdout: '' })
    })
  })

  it('Claude MCP hook parses mcp__server__tool names', () => {
    const blocked = runHook('guard-mcp.mjs', 'claude', {
      tool_name: 'mcp__vercel__deploy_to_vercel',
      tool_input: {},
    })
    expect(blocked.status).toBe(2)

    const allowed = runHook(
      'guard-mcp.mjs',
      'claude',
      { tool_name: 'mcp__neon__run_sql', tool_input: { branchId: 'br-dev' } },
      { NEON_AGENT_BRANCH_IDS: 'br-dev' },
    )
    expect(allowed.status).toBe(0)
  })
})

describe('Claude Code file permissions (.claude/settings.json)', () => {
  const settings = JSON.parse(
    readFileSync(new URL('../../.claude/settings.json', import.meta.url), 'utf8'),
  ) as { permissions: { allow: string[]; deny: string[] } }

  it.each(['Read', 'Edit', 'Write'])('denies %s of production env files and .vercel/', (tool) => {
    expect(settings.permissions.deny).toEqual(
      expect.arrayContaining([`${tool}(**/.env.production*)`, `${tool}(**/.vercel/**)`]),
    )
  })

  it.each(['Read', 'Edit', 'Write'])(
    'allows %s of the per-checkout local env files only',
    (tool) => {
      expect(settings.permissions.allow).toEqual(
        expect.arrayContaining([`${tool}(.env.development.local)`, `${tool}(.env.test.local)`]),
      )
      const envRules = settings.permissions.allow.filter((rule) => rule.includes('.env'))
      expect(envRules.every((rule) => /\(\.env\.(development|test)\.local\)$/.test(rule))).toBe(
        true,
      )
    },
  )
})
