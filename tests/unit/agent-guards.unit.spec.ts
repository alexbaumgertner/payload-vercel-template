// @vitest-environment node
import { spawnSync } from 'node:child_process'
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
    ['git reset --hard origin/main', 'hard reset to remote'],
    ['psql -c "DROP TABLE users"', 'drop table'],
    ['psql "$DATABASE_URL" -c "truncate waitlist_signups"', 'truncate'],
    ['pnpm payload migrate:fresh', 'migrate:fresh'],
    ['pnpm payload migrate:down', 'migrate:down'],
    ['psql postgresql://u:p@ep-cool-123-pooler.eu-central-1.aws.neon.tech/neondb', 'Neon URL'],
    ['DATABASE_URL=postgres://u:p@ep-x.neon.tech/db pnpm seed', 'Neon URL in env prefix'],
    ['neonctl branches delete main', 'Neon CLI'],
    ['npx neon connection-string', 'Neon CLI via npx'],
    ['vercel --prod', 'prod deploy'],
    ['vercel deploy --prebuilt --prod', 'prod deploy with flags in between'],
    ['vercel promote dpl_123', 'promote'],
    ['vercel rollback', 'rollback'],
    ['pnpm dlx vercel env pull .env', 'env pull'],
    ['vercel env add DATABASE_URL production', 'env add'],
  ])('blocks %s (%s)', (command) => {
    expect(checkShellCommand(command).allowed).toBe(false)
  })

  it.each([
    'pnpm check',
    'pnpm test:int',
    'rm -rf node_modules .next',
    'rm -rf ./media/*',
    'git push -u origin main',
    'git push --force-with-lease origin feature/x',
    'git reset --hard HEAD~1',
    'pnpm migrate:create add-tags',
    'psql postgresql://app:app@127.0.0.1:5432/app -c "select 1"',
    'vercel --help',
    'vercel deploy',
    'vercel env ls',
    'neonctl --help',
    'echo "neon lights" && grep -r vercel docs',
    'rg "drop shadow" src',
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
