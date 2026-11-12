// Runs .claude/rule-hook/hook.py, the PreToolUse hook that .claude/settings.json
// runs on every tool call, for the tests of the hook and of its rules. CI runs
// the hook itself, never a port: a hook that crashes or cannot start lets
// every call through.
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const REPO = path.resolve(import.meta.dir, '..');
const HOOK = path.join(REPO, '.claude/rule-hook/hook.py');
export const RULES_DIR = path.join(REPO, '.claude/rule-hook/rules');
// By its path, so that a run with an empty environment still finds it.
const PYTHON = Bun.which('python3') ?? 'python3';

export type HookOutput = {
  hookSpecificOutput?: {
    hookEventName: string;
    permissionDecision?: string;
    permissionDecisionReason?: string;
    additionalContext?: string;
  };
  systemMessage?: string;
};

export type Rule = {
  name: string;
  enabled: boolean | string;
  event: string;
  action: string;
  pattern: string | null;
  tool_matcher: string | null;
  conditions: { field: string; operator: string; pattern: string }[];
  message: string;
};

export const preToolUse = (tool_name: string, tool_input: Record<string, unknown>) => ({
  hook_event_name: 'PreToolUse',
  tool_name,
  tool_input
});

// A rule file's message: its text after the frontmatter, trimmed.
const ruleMessage = (name: string) =>
  readFileSync(path.join(RULES_DIR, `${name}.md`), 'utf8')
    .split('---')
    .slice(2)
    .join('---')
    .trim();

// The text the hook gives the agent for these rules, joined as hookify joins
// them.
export const combined = (...names: string[]) =>
  names.map((name) => `**[${name}]**\n${ruleMessage(name)}`).join('\n\n');

// Runs the hook as .claude/settings.json does: `python3 -I hook.py`, the
// input on stdin. Its exit code, stderr and parsed stdout.
export function runHook(
  input: unknown,
  { cwd = REPO, env }: { cwd?: string; env?: Record<string, string> } = {}
) {
  const run = Bun.spawnSync([PYTHON, '-I', HOOK], {
    cwd,
    env,
    stdin: Buffer.from(typeof input === 'string' ? input : JSON.stringify(input)),
    timeout: 10_000
  });
  const stdout = run.stdout.toString();
  return {
    exitCode: run.exitCode,
    stderr: run.stderr.toString(),
    output: (stdout ? JSON.parse(stdout) : null) as HookOutput | null
  };
}

// Calls one of the hook's own functions on each argument in one Python
// process: hundreds of cases would otherwise start hundreds of processes.
// -B keeps the import from writing .claude/rule-hook/__pycache__.
const DRIVER = `
import dataclasses, importlib.util, json, sys
spec = importlib.util.spec_from_file_location("hook", sys.argv[1])
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)
fn = getattr(hook, sys.argv[2])
out = [fn(arg) for arg in json.load(sys.stdin)]
print(json.dumps(out, default=lambda o: dataclasses.asdict(o) if dataclasses.is_dataclass(o) else o.pattern))
`;

function callHook(fn: string, args: unknown[]): unknown[] {
  const run = Bun.spawnSync([PYTHON, '-I', '-B', '-c', DRIVER, HOOK, fn], {
    stdin: Buffer.from(JSON.stringify(args)),
    timeout: 60_000
  });
  const stderr = run.stderr.toString();
  if (run.exitCode !== 0 || stderr) {
    throw new Error(
      `hook.py ${fn} exited ${run.exitCode} (${run.signalCode ?? 'no signal'}): ${stderr}`
    );
  }
  return JSON.parse(run.stdout.toString());
}

// The hook's answer to each PreToolUse input (its respond()).
export const respondAll = (inputs: unknown[]) => callHook('respond', inputs) as HookOutput[];

// Each rule file as the hook's loader reads it (its load_rule_file()).
export const loadRuleFiles = (files: string[]) => callHook('load_rule_file', files) as Rule[];

// Each pattern as the hook compiles it (its compile_regex()); throws on a
// pattern Python cannot compile, which the hook would skip in silence.
export const compilePatterns = (patterns: string[]) => callHook('compile_regex', patterns);

// The seconds the hook's compiled pattern (its compile_regex()) takes to
// search each text, timed inside one Python process, so that neither its
// start-up nor the compile counts.
const TIMER = `
import importlib.util, json, sys, time
spec = importlib.util.spec_from_file_location("hook", sys.argv[1])
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)
regex = hook.compile_regex(sys.argv[2])
out = []
for text in json.load(sys.stdin):
    start = time.perf_counter()
    regex.search(text)
    out.append(time.perf_counter() - start)
print(json.dumps(out))
`;

export function searchSeconds(pattern: string, texts: string[]): number[] {
  const run = Bun.spawnSync([PYTHON, '-I', '-B', '-c', TIMER, HOOK, pattern], {
    stdin: Buffer.from(JSON.stringify(texts)),
    timeout: 60_000
  });
  const stderr = run.stderr.toString();
  if (run.exitCode !== 0 || stderr) {
    throw new Error(
      `hook.py search timer exited ${run.exitCode} (${run.signalCode ?? 'no signal'}): ${stderr}`
    );
  }
  return JSON.parse(run.stdout.toString());
}
