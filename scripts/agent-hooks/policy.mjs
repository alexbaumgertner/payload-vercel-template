// Pure policy for the agent guards (shell + MCP). No I/O, so it is unit-tested directly:
// tests/unit/agent-guards.unit.spec.ts

/** @typedef {{ allowed: true } | { allowed: false, reason: string }} Verdict */

const ALLOW = /** @type {Verdict} */ ({ allowed: true })
const deny = (reason) => /** @type {Verdict} */ ({ allowed: false, reason })

// Start of a command: beginning of the line or after a shell separator.
const CMD = String.raw`(?:^|[;&|(]\s*|\bnpx\s+|\bpnpm\s+(?:exec\s+|dlx\s+)?)`

// `DATABASE_URL=postgres://…@127.0.0.1|localhost[:port]/<scratch db>` right before the command.
// Scratch databases: `app_test`, a checkout's `app_<suffix>_test` (scripts/local-env.sh) and `app_migr*`.
const LOCAL_SCRATCH_MIGRATE = new RegExp(
  String.raw`^\s*(?:\w+=\S+\s+)*DATABASE_URL=["']?postgres(?:ql)?:\/\/[^\s@/]*@(?:127\.0\.0\.1|localhost)(?::\d+)?\/(?:app_test|app_\w+_test|app_migr\w*)["']?(?:\s+\w+=\S+)*\s+(?:pnpm\s+)?(?:exec\s+)?(?:payload\s+)?migrate:(?:fresh|reset|down)\b`,
)

const SHELL_RULES = [
  {
    pattern:
      /\brm\s+(?:-[a-z]+\s+)*-[a-z]*r[a-z]*\s+(?:-[a-z]+\s+)*["']?(?:\/|~|\$HOME)\/?\*?["']?(?:\s|$)/i,
    reason: 'recursive delete of a root/home path',
  },
  {
    pattern: /\bgit\s+push\b(?=.*(?:\s--force(?!-with-lease)\b|\s-[a-zA-Z]*f\b|\s\+\S))/,
    reason: 'force push (use --force-with-lease on your own branch)',
  },
  {
    // `origin main`, `HEAD:main`, `+main`, `refs/heads/main`; not `feature/main-page`.
    pattern: /\bgit\s+push\b[^;&|\n]*\s(?:\S*:|\+)?(?:refs\/heads\/)?(?:main|master)(?![\w/.-])/,
    reason: 'push to the main branch — push your branch and open a PR',
  },
  {
    pattern: /\bgit\s+reset\s+--hard\s+(?:origin|upstream)\//,
    reason: 'hard reset to remote discards local work',
  },
  {
    pattern: /\b(?:drop\s+(?:database|schema|table|owned)|truncate\s+(?:table\s+)?\w)/i,
    reason: 'destructive SQL',
  },
  {
    pattern: /\bmigrate:(?:fresh|reset|down)\b/,
    reason: 'drops or rolls back data — run it yourself if you really mean it',
    // Allowed only against a local scratch database named in the same command segment; the dev
    // database `app` and anything remote stay blocked.
    unless: LOCAL_SCRATCH_MIGRATE,
  },
  {
    pattern: /postgres(?:ql)?:\/\/\S*neon\.tech/i,
    reason: 'direct access to a Neon (production) database',
  },
  {
    // Human-only switch that lets local tooling connect to a remote (production) database.
    pattern: /(?:^|[;&|(\n]\s*|\b(?:env|export)\s+)(?:\w+=\S*\s+)*ALLOW_REMOTE_DATABASE=["']?1\b/,
    reason: 'ALLOW_REMOTE_DATABASE=1 points local tooling at a remote database — a human sets it',
  },
  {
    pattern: new RegExp(`${CMD}neon(?:ctl)?\\s+(?!(?:--help|-h|help|docs)\\b)\\S`),
    reason: 'the Neon CLI acts on cloud databases — run it yourself',
  },
  {
    pattern: new RegExp(`${CMD}vercel\\b.*(?:\\s--prod\\b|\\s(?:promote|rollback|remove|rm)\\b)`),
    reason: 'production deploys and removals are done by a human',
  },
  {
    pattern: new RegExp(`${CMD}vercel\\s+(?:env\\s+)?pull\\b`),
    reason: 'writes production secrets into the checkout',
  },
  {
    pattern: new RegExp(`${CMD}vercel\\s+env\\s+(?:add|rm|remove|update)\\b`),
    reason: 'touches deployment secrets',
  },
]

/** @param {string} command @returns {Verdict} */
export function checkShellCommand(command) {
  const hit = SHELL_RULES.find(
    (rule) => rule.pattern.test(command) && !(rule.unless && everySegmentMatches(command, rule)),
  )
  return hit ? deny(hit.reason) : ALLOW
}

// Every shell segment that trips the rule must satisfy its exception: an allowed local
// segment cannot smuggle in a second one (`a && b`, `a; b`, `a | b`, a new line, `$(b)`, `` `b` ``).
function everySegmentMatches(command, rule) {
  return command
    .split(/&&|\|\||[;&|\n`()]/)
    .filter((segment) => rule.pattern.test(segment))
    .every((segment) => rule.unless.test(segment))
}

// --- MCP ---------------------------------------------------------------------------------
// Allow-lists, not deny-lists: both servers add tools over time and anything new is denied
// until someone reviews it here.

const NEON_DB_TOOLS = new Set([
  'run_sql',
  'run_sql_transaction',
  'explain_sql_statement',
  'get_database_tables',
  'describe_table_schema',
  'describe_branch',
  'inspect_database',
  'list_slow_queries',
  'compare_database_schema',
])
const NEON_SECRET_TOOLS = new Set(['get_connection_string', 'list_credentials'])
const NEON_READ = /^(?:list_|get_|describe_)|^(?:search|fetch|query_logs)$/

const VERCEL_SECRET_TOOLS = new Set([
  'get_project_env',
  'filter_project_envs',
  'get_shared_env_var',
  'get_auth_token',
  'get_project_token',
  'get_edge_config_token',
  'get_access_to_vercel_url',
])
const VERCEL_READ = /^(?:list_|get_|search_|check_)|^web_fetch_vercel_url$/

/** @param {string | undefined} value */
const idList = (value) =>
  new Set(
    (value ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  )

/**
 * @param {{ server?: string, url?: string, tool?: string, input?: unknown }} call
 * @param {{ NEON_AGENT_BRANCH_IDS?: string }} env
 * @returns {Verdict}
 */
export function checkMcpCall({ server = '', url = '', tool = '', input }, env = {}) {
  const id = `${server} ${url}`.toLowerCase()
  const args = typeof input === 'string' ? safeJson(input) : (input ?? {})

  if (id.includes('neon')) {
    if (NEON_DB_TOOLS.has(tool)) {
      const branch = typeof args.branchId === 'string' ? args.branchId : ''
      return idList(env.NEON_AGENT_BRANCH_IDS).has(branch)
        ? ALLOW
        : deny(
            `neon:${tool} reads a database; only branches listed in NEON_AGENT_BRANCH_IDS are allowed ` +
              '(an omitted branchId means the default — production — branch)',
          )
    }
    if (NEON_SECRET_TOOLS.has(tool)) return deny(`neon:${tool} returns credentials`)
    return NEON_READ.test(tool) ? ALLOW : deny(`neon:${tool} changes Neon resources`)
  }

  if (id.includes('vercel')) {
    if (VERCEL_SECRET_TOOLS.has(tool)) return deny(`vercel:${tool} exposes secrets or access`)
    return VERCEL_READ.test(tool)
      ? ALLOW
      : deny(`vercel:${tool} changes deployments, settings or billing`)
  }

  return ALLOW
}

/** Claude Code names MCP tools `mcp__<server>__<tool>`. */
export function parseClaudeToolName(name = '') {
  const match = /^mcp__(.+?)__(.+)$/.exec(name)
  return match ? { server: match[1], tool: match[2] } : null
}

function safeJson(text) {
  try {
    const value = JSON.parse(text)
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}
