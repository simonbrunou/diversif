// docs/claude-setup.md against the config it describes (#720 retro). Until
// #720, the doc listed four hooks, three skills and an agent that #274 (June)
// and dcae9d49 and 5a68a487 (October) had removed. These tests read its Hooks
// list, its project skills and agents list, its cloud sentence that names
// them again, and its two MCP lines, in the forms the doc uses today, and fail
// with a message naming any other form.
import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repo = path.join(import.meta.dir, '..');

type HookGroup = { matcher?: string; hooks: { command: string }[] };
type Setup = {
  doc: string;
  hooks: Record<string, HookGroup[]>;
  // Server name to the command line it runs.
  mcpServers: Record<string, string>;
  skills: string[];
  agents: string[];
};

// .mcp.json's servers as `command arg…` lines. A server in another form (an
// http server with a url, args that are not strings) throws.
function mcpCommands(servers: Record<string, Record<string, unknown>>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(servers).map(([name, { command, args = [] }]) => {
      if (
        typeof command !== 'string' ||
        !Array.isArray(args) ||
        !args.every((arg) => typeof arg === 'string')
      )
        throw new Error(`.mcp.json server ${name} is not a command with string args`);
      return [name, [command, ...args].join(' ')];
    })
  );
}

function readSetup(): Setup {
  const json = (file: string) => JSON.parse(readFileSync(path.join(repo, file), 'utf8'));
  return {
    doc: readFileSync(path.join(repo, 'docs/claude-setup.md'), 'utf8'),
    hooks: json('.claude/settings.json').hooks ?? {},
    mcpServers: mcpCommands(json('.mcp.json').mcpServers ?? {}),
    skills: readdirSync(path.join(repo, '.claude/skills'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
    agents: readdirSync(path.join(repo, '.claude/agents'))
      .filter((file) => file.endsWith('.md'))
      .map((file) => file.slice(0, -'.md'.length))
  };
}

// The sub-items of the top-level list item whose first line starts with head.
// A `  - ` line opens a sub-item and each 4-space line after it continues it.
// Before the first sub-item, 2-space lines continue the head itself.
function subItems(doc: string, head: string): string[] {
  const lines = doc.split('\n');
  const start = lines.findIndex((line) => line.startsWith(head));
  if (start === -1) throw new Error(`docs/claude-setup.md has no line starting "${head}"`);
  const items: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('  - ')) items.push(line.slice(4));
    else if (line.startsWith('    ') && items.length > 0)
      items[items.length - 1] += ` ${line.trim()}`;
    else if (line.startsWith('  ') && items.length === 0) continue;
    else if (line === '' || line.startsWith('- ')) break;
    else throw new Error(`unexpected line under "${head}": ${line}`);
  }
  return items;
}

const sorted = (list: string[]) => [...list].sort();

// One `<event> (<matcher>) → <script>` per hook command, from each side.
function docHooks(doc: string): string[] {
  return subItems(doc, '- **Hooks** (`hooks`):').map((item) => {
    const m = /^`(\w+)` \(([^)]+)\) → `([^`]+)` — /.exec(item);
    if (!m)
      throw new Error(`Hooks entry not in the form "\`Event\` (matcher) → \`script\` — ": ${item}`);
    return `${m[1]} (${m[2]}) → ${m[3]}`;
  });
}

function settingsHooks(hooks: Record<string, HookGroup[]>): string[] {
  return Object.entries(hooks).flatMap(([event, groups]) =>
    groups.flatMap((group) =>
      group.hooks.map(({ command }) => {
        const m = /"\$CLAUDE_PROJECT_DIR"\/([^\s"]+)/.exec(command);
        if (!m) throw new Error(`hook command runs no "$CLAUDE_PROJECT_DIR"/<path>: ${command}`);
        return `${event} (${group.matcher ?? 'every tool'}) → ${m[1]}`;
      })
    )
  );
}

function docSkillsAndAgents(doc: string): { skills: string[]; agents: string[] } {
  const skills: string[] = [];
  const agents: string[] = [];
  for (const item of subItems(doc, '- **Project skills & agents**')) {
    const skill = /^`\.claude\/skills\/([\w-]+)\/` — /.exec(item);
    const agent = /^`\.claude\/agents\/([\w-]+)\.md` — /.exec(item);
    if (skill) skills.push(skill[1]);
    else if (agent) agents.push(agent[1]);
    else throw new Error(`project skills & agents entry in another form: ${item}`);
  }
  return { skills, agents };
}

const names = (list: string) => [...list.matchAll(/`([\w-]+)`/g)].map((m) => m[1]);

// The cloud section names the same skills and agents in one sentence.
function cloudSkillsAndAgents(doc: string): { skills: string[]; agents: string[] } {
  const flat = doc.replace(/\s+/g, ' ');
  const m =
    /the project skills \(((?:`[\w-]+`(?:, )?)+)\) and the ((?:`[\w-]+`(?:, | and )?)+) agents;/.exec(
      flat
    );
  if (!m)
    throw new Error('no "the project skills (`a`, `b`) and the `c` and `d` agents;" sentence');
  return { skills: names(m[1]), agents: names(m[2]) };
}

// The intro sentence names the .mcp.json server, and the MCP servers list
// names it with the command it runs, as `name: command arg…`.
function docMcpServers(doc: string): { intro: string[]; list: string[] } {
  const flat = doc.replace(/\s+/g, ' ');
  const intro = /`\.mcp\.json` declares one more MCP server, `([\w-]+)`\./.exec(flat);
  if (!intro) throw new Error('no "`.mcp.json` declares one more MCP server, `name`." sentence');
  const item = subItems(doc, '- **MCP servers**:').find((line) =>
    line.startsWith('declared in `.mcp.json` (`mcpServers`): ')
  );
  if (!item) throw new Error('no "declared in `.mcp.json` (`mcpServers`): " MCP servers entry');
  return {
    intro: [intro[1]],
    list: [...item.matchAll(/`([\w-]+)`, which runs `([^`]+)`/g)].map((m) => `${m[1]}: ${m[2]}`)
  };
}

function problems(setup: Setup): string[] {
  const found: string[] = [];
  const compare = (what: string, doc: string[], repoSide: string[]) => {
    const missing = repoSide.filter((name) => !doc.includes(name));
    const extra = doc.filter((name) => !repoSide.includes(name));
    if (missing.length) found.push(`${what}: the doc leaves out ${sorted(missing).join(', ')}`);
    if (extra.length)
      found.push(`${what}: the doc names ${sorted(extra).join(', ')}, which the repo lacks`);
  };
  compare('Hooks', docHooks(setup.doc), settingsHooks(setup.hooks));
  const list = docSkillsAndAgents(setup.doc);
  compare('project skills', list.skills, setup.skills);
  compare('project agents', list.agents, setup.agents);
  const cloud = cloudSkillsAndAgents(setup.doc);
  compare('cloud project skills', cloud.skills, setup.skills);
  compare('cloud agents', cloud.agents, setup.agents);
  const mcp = docMcpServers(setup.doc);
  compare('MCP intro sentence', mcp.intro, Object.keys(setup.mcpServers));
  compare(
    'MCP servers list',
    mcp.list,
    Object.entries(setup.mcpServers).map(([name, run]) => `${name}: ${run}`)
  );
  return found;
}

// The real setup with one change. replaceOnce throws when `from` is not in the
// doc exactly once, so a fixture whose edit misses goes red instead of
// testing the unchanged doc.
const real = readSetup();
function replaceOnce(text: string, from: string, to: string): string {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`fixture edit matches ${count} times: ${from}`);
  return text.replace(from, to);
}
const withDoc = (from: string, to: string): Setup => ({
  ...real,
  doc: replaceOnce(real.doc, from, to)
});
const sessionStart =
  '  - `SessionStart` (startup|resume) → `scripts/session-bootstrap.sh` — on Claude';

describe('docs/claude-setup.md', () => {
  it('names the hooks, project skills, agents and MCP servers the repo declares', () => {
    expect(problems(real)).toEqual([]);
  });

  describe('Hooks list', () => {
    it('flags a hook the doc names and settings.json lacks', () => {
      const doc = withDoc(
        sessionStart,
        '  - `PostToolUse` (Write|Edit) → `.claude/hooks/format-edited.sh` — formats.\n' +
          sessionStart
      );
      expect(problems(doc)).toEqual([
        'Hooks: the doc names PostToolUse (Write|Edit) → .claude/hooks/format-edited.sh, which the repo lacks'
      ]);
    });

    it('flags a hook settings.json declares and the doc leaves out', () => {
      const hooks = {
        ...real.hooks,
        Stop: [{ hooks: [{ command: '"$CLAUDE_PROJECT_DIR"/scripts/stop.sh' }] }]
      };
      expect(problems({ ...real, hooks })).toEqual([
        'Hooks: the doc leaves out Stop (every tool) → scripts/stop.sh'
      ]);
    });

    it('flags a matcher or a script the doc gets wrong', () => {
      expect(
        problems(withDoc('`SessionStart` (startup|resume)', '`SessionStart` (startup)'))
      ).toEqual([
        'Hooks: the doc leaves out SessionStart (startup|resume) → scripts/session-bootstrap.sh',
        'Hooks: the doc names SessionStart (startup) → scripts/session-bootstrap.sh, which the repo lacks'
      ]);
      expect(
        problems(withDoc('→ `scripts/session-bootstrap.sh`', '→ `scripts/bootstrap.sh`'))
      ).toEqual([
        'Hooks: the doc leaves out SessionStart (startup|resume) → scripts/session-bootstrap.sh',
        'Hooks: the doc names SessionStart (startup|resume) → scripts/bootstrap.sh, which the repo lacks'
      ]);
    });

    it('refuses an entry in another form', () => {
      const doc = withDoc(
        sessionStart,
        '  - `PreToolUse` (Bash) — graphify: nudges Claude to read `graphify-out/`.\n' +
          sessionStart
      );
      expect(() => problems(doc)).toThrow('Hooks entry not in the form');
    });

    it('refuses a hook command that runs no "$CLAUDE_PROJECT_DIR"/<path>', () => {
      const hooks = { ...real.hooks, Stop: [{ hooks: [{ command: 'echo done' }] }] };
      expect(() => problems({ ...real, hooks })).toThrow('hook command runs no');
    });

    it('refuses a doc without the Hooks list', () => {
      expect(() => problems(withDoc('- **Hooks** (`hooks`):', '- **Hook events**:'))).toThrow(
        'docs/claude-setup.md has no line starting "- **Hooks** (`hooks`):"'
      );
    });

    it('refuses a line in another form under the list', () => {
      expect(() => problems(withDoc(sessionStart, '   ' + sessionStart.trimStart()))).toThrow(
        'unexpected line under "- **Hooks** (`hooks`):"'
      );
    });
  });

  describe('project skills and agents', () => {
    it('flags a skill or an agent the doc names and the repo lacks', () => {
      const setup = { ...real, skills: real.skills.filter((name) => name !== 'fallow') };
      expect(problems(setup)).toEqual([
        'project skills: the doc names fallow, which the repo lacks',
        'cloud project skills: the doc names fallow, which the repo lacks'
      ]);
      const agents = real.agents.filter((name) => name !== 'webauthn-auth-reviewer');
      expect(problems({ ...real, agents })).toEqual([
        'project agents: the doc names webauthn-auth-reviewer, which the repo lacks',
        'cloud agents: the doc names webauthn-auth-reviewer, which the repo lacks'
      ]);
    });

    it('flags a skill or an agent the repo has and the doc leaves out', () => {
      expect(problems({ ...real, skills: [...real.skills, 'council'] })).toEqual([
        'project skills: the doc leaves out council',
        'cloud project skills: the doc leaves out council'
      ]);
      expect(problems({ ...real, agents: [...real.agents, 'security-reviewer'] })).toEqual([
        'project agents: the doc leaves out security-reviewer',
        'cloud agents: the doc leaves out security-reviewer'
      ]);
    });

    it('flags the cloud sentence alone when only it drifts', () => {
      expect(problems(withDoc('`i18n-add-key`, `pre-launch-check`)', '`i18n-add-key`)'))).toEqual([
        'cloud project skills: the doc leaves out pre-launch-check'
      ]);
    });

    it('refuses a list entry in another form', () => {
      expect(() =>
        problems(
          withDoc('  - `.claude/skills/fallow/` — ', '  - `.claude/skills/fallow/SKILL.md` — ')
        )
      ).toThrow('project skills & agents entry in another form');
    });

    it('refuses a doc without the cloud sentence', () => {
      expect(() =>
        problems(
          withDoc('the project skills (`create-migration`', 'the skills (`create-migration`')
        )
      ).toThrow('no "the project skills');
    });
  });

  describe('MCP servers', () => {
    const sqlite = real.mcpServers.sqlite;

    it('flags a .mcp.json server the doc leaves out, or one it names that .mcp.json lacks', () => {
      const mcpServers = { ...real.mcpServers, postgres: 'npx postgres-mcp' };
      expect(problems({ ...real, mcpServers })).toEqual([
        'MCP intro sentence: the doc leaves out postgres',
        'MCP servers list: the doc leaves out postgres: npx postgres-mcp'
      ]);
      expect(problems({ ...real, mcpServers: {} })).toEqual([
        'MCP intro sentence: the doc names sqlite, which the repo lacks',
        `MCP servers list: the doc names sqlite: ${sqlite}, which the repo lacks`
      ]);
    });

    it('flags a command the doc quotes and .mcp.json no longer runs', () => {
      const bumped = sqlite.replace(/@[\d.]+ /, '@99.0.0 ');
      expect(bumped).not.toBe(sqlite);
      expect(problems({ ...real, mcpServers: { sqlite: bumped } })).toEqual([
        `MCP servers list: the doc leaves out sqlite: ${bumped}`,
        `MCP servers list: the doc names sqlite: ${sqlite}, which the repo lacks`
      ]);
      expect(problems(withDoc(`\`${sqlite}\``, `\`${bumped}\``))).toEqual([
        `MCP servers list: the doc leaves out sqlite: ${sqlite}`,
        `MCP servers list: the doc names sqlite: ${bumped}, which the repo lacks`
      ]);
    });

    it('refuses a .mcp.json server that is not a command with string args', () => {
      expect(() => mcpCommands({ remote: { url: 'https://mcp.example.invalid' } })).toThrow(
        '.mcp.json server remote is not a command with string args'
      );
      expect(() => mcpCommands({ db: { command: 'npx', args: ['db', 1] } })).toThrow(
        '.mcp.json server db is not a command with string args'
      );
      expect(() => mcpCommands({ db: { command: 'npx', args: 'db' } })).toThrow(
        '.mcp.json server db is not a command with string args'
      );
      expect(mcpCommands({ db: { command: 'db-mcp' } })).toEqual({ db: 'db-mcp' });
    });

    it('refuses a doc without the intro sentence or the list entry', () => {
      expect(() => problems(withDoc('declares one more MCP server', 'also declares'))).toThrow(
        'no "`.mcp.json` declares one more MCP server'
      );
      expect(() =>
        problems(withDoc('  - declared in `.mcp.json` (`mcpServers`): ', '  - from `.mcp.json`: '))
      ).toThrow('no "declared in `.mcp.json` (`mcpServers`): " MCP servers entry');
    });
  });
});
