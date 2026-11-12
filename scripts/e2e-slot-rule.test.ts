// .claude/rule-hook/rules/block-e2e-start-without-slot.md against the
// commands it must block or pass (#645, #651, #655, #710, #715). Each case goes
// through the repo's PreToolUse hook, .claude/rule-hook/hook.py, as a Bash call:
// its own loader and engine (hookify 0.1.1's, in Python: a hand-rolled
// frontmatter parser, each condition ANDed, `regex_match` as re.search with
// re.IGNORECASE), so CI checks the verdicts Claude Code gets (#663). Before you
// make the rule read a new option, see scripts/rule-hook.test.ts's header for
// the ways to write one that each need a case.
import { afterAll, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  type HookOutput,
  loadRuleFiles,
  preToolUse,
  respondAll,
  RULES_DIR,
  runHook,
  searchSeconds
} from './rule-hook';

const RULE = 'block-e2e-start-without-slot';
const rule = loadRuleFiles([path.join(RULES_DIR, `${RULE}.md`)])[0];

// A deny from this rule: no other Bash rule matches these cases, so a deny
// that names another rule, or none, fails the test that asked.
function denies(output: HookOutput | null | undefined) {
  if (output == null) throw new Error('the hook gave no answer');
  const decision = output.hookSpecificOutput?.permissionDecision;
  if (decision === undefined) return false;
  const reason = output.hookSpecificOutput?.permissionDecisionReason ?? '';
  if (decision !== 'deny' || reason !== `**[${RULE}]**\n${rule.message}`) {
    throw new Error(`unexpected answer: ${JSON.stringify(output)}`);
  }
  return true;
}

// Each command that starts an E2E job.
const STARTS = [
  'fj pr -R origin create --base main --head x --body-file b.md "t"',
  'fj pr -R origin merge 640 -d',
  'fj pr --remote origin merge 640',
  'fj pr create --head x',
  'nix develop . -c fj pr -R origin merge 640 -d',
  'nix develop /w --command fj pr merge 640',
  'fj -H git.sbrn.eu pr create --head x',
  'fj --host git.sbrn.eu --style minimal pr merge 640',
  'curl -s -X POST -H "Authorization: token $T" https://git.sbrn.eu/api/v1/repos/simonbrunou/diversif/actions/jobs/13858/rerun',
  'curl -X POST https://git.sbrn.eu/api/v1/repos/simonbrunou/diversif/actions/runs/3405/rerun',
  'curl -X POST https://git.sbrn.eu/api/v1/repos/simonbrunou/diversif/pulls/642/merge',
  'curl -X POST "$API/actions/runs/3405/rerun"',
  'curl -X POST "$API/actions/jobs/13858/rerun"',
  'curl -X POST "${API}/pulls/642/merge"',
  'curl -X POST "$API"/pulls/642/merge',
  // Any variable can hold the API base: the #674 session used $A.
  'curl -s -X POST -H "Authorization: token $T" "$A/actions/jobs/15510/rerun"',
  'curl -X POST "${REPO_API}/actions/runs/3405/rerun"',
  'curl -X POST $BASE/pulls/642/merge',
  'curl -X POST "$BASE"/pulls/642/merge',
  'curl -X POST ${REPO_API}/actions/jobs/13858/rerun',
  'curl -X POST "$API2/pulls/642/merge"',
  'curl -X POST "$_API/actions/jobs/13858/rerun"',
  'curl -X POST "${API%/}/actions/runs/3405/rerun"',
  'curl -X POST "${API:-x}/pulls/642/merge"',
  'curl -X POST "$1/actions/jobs/13858/rerun"',
  'echo 640 | xargs fj pr merge'
];

// Start commands inside a loop or an if block. Its ; or newline ends the
// slot call's chain as the rule reads it, so they block behind a slot call
// too, though the shell gates them, and the message sends them to a plain
// && chain (#715).
const BLOCK_STARTS = ['for n in 1 2; do fj pr merge $n; done', 'if true; then fj pr merge 640; fi'];

const MERGE = 'fj pr -R origin merge 640 -d';
// A "$(…)" the rule reads: no quotes inside, a plain variable at most.
const SUBST = 'scripts/wait-e2e-slot.sh "$(git rev-parse origin/$B)"';
// The same call with quotes inside the "$(…)", which the rule blocks (#710).
const INNER_QUOTES = 'scripts/wait-e2e-slot.sh "$(git rev-parse "origin/$B")"';

// Slot checks that gate whatever follows them.
const SLOTS: Record<string, string> = {
  'no argument': 'scripts/wait-e2e-slot.sh && ',
  'short SHA': 'scripts/wait-e2e-slot.sh c2403f8 && ',
  'full SHA': 'scripts/wait-e2e-slot.sh c2403f87b1e8c3d0a4f5e6b7c8d9e0f1a2b3c4d5 && ',
  'quoted rev-parse': 'scripts/wait-e2e-slot.sh "$(git rev-parse origin/x)" && ',
  'single-quoted SHA': "scripts/wait-e2e-slot.sh 'c2403f8' && ",
  'after cd and T=': 'cd /w && T=$(cat k) && scripts/wait-e2e-slot.sh c2403f8 && ',
  'rev-parse, variable': SUBST + ' && ',
  'curl | jq, variable':
    'scripts/wait-e2e-slot.sh "$(curl -s $API/pulls/640 | jq -r .head.sha)" && ',
  redirect: 'scripts/wait-e2e-slot.sh > /tmp/slot.out 2>&1 && ',
  'SHA, redirect': 'scripts/wait-e2e-slot.sh c2403f8 > /tmp/slot.out 2>&1 && '
};

// The blocking cases #710 and #715 added or moved, grouped by the shells
// that run their start command (the merge, or a rerun through curl) behind a
// slot script that exits 3. SHELL_GROUPS names the shells of each group, and
// « the #710 and #715 cases in a shell » below checks them in bash and, where
// it is installed, zsh. The comments inside a group say why; no test reads
// them.
const START_IN_BOTH_SHELLS: Record<string, string> = {
  // The start command sits past the end of the slot call's && chain: a ;, a
  // lone &, a newline or a || (#715).
  'chained, then semicolon': 'scripts/wait-e2e-slot.sh && echo ok; ' + MERGE,
  'chained, then newline': 'scripts/wait-e2e-slot.sh && git fetch -q\n' + MERGE,
  'chained, then ||': 'scripts/wait-e2e-slot.sh && true || ' + MERGE,
  'chained, then &': 'scripts/wait-e2e-slot.sh && true & ' + MERGE,
  'chained, then &, no blanks': 'scripts/wait-e2e-slot.sh && true&' + MERGE,
  'chained, then || and a newline': 'scripts/wait-e2e-slot.sh && true ||\n' + MERGE,
  'second start after ;': 'scripts/wait-e2e-slot.sh && ' + MERGE + '; fj pr -R origin merge 641 -d',
  'second start after ||':
    'scripts/wait-e2e-slot.sh && ' + MERGE + ' || fj pr -R origin merge 641 -d',
  'chained, then semicolon, rerun URL':
    'scripts/wait-e2e-slot.sh && echo ok; curl -X POST "$API/actions/runs/3405/rerun"',
  // The start command runs before the slot call, or a || skips the call.
  'start before the slot call': MERGE + '; scripts/wait-e2e-slot.sh && echo ok',
  'start chained before the slot call': MERGE + ' && scripts/wait-e2e-slot.sh && echo ok',
  '|| before the slot call': 'true || scripts/wait-e2e-slot.sh && ' + MERGE,
  // The rerun of the unit job starts no E2E job, but the rule cannot tell.
  'unit rerun before the slot call':
    'curl -X POST "$API/actions/jobs/15458/rerun"; scripts/wait-e2e-slot.sh && curl -X POST "$API/actions/jobs/15459/rerun"',
  // ! turns the busy exit 3 into success.
  'negated slot call': '! scripts/wait-e2e-slot.sh && ' + MERGE,
  'negated pipeline into the slot call': '! true | scripts/wait-e2e-slot.sh && ' + MERGE,
  'negated slot call after cd': 'cd /w && ! scripts/wait-e2e-slot.sh c2403f8 && ' + MERGE,
  'negated slot call through nix develop':
    '! nix develop . -c scripts/wait-e2e-slot.sh && ' + MERGE,
  // Another ! after the negated slot call: a check that stopped at any !
  // would miss the first one.
  'negated slot call, then another !': '! scripts/wait-e2e-slot.sh && ! false && ' + MERGE,
  // An argument whose quote, backslash, backtick, $, #, <, parenthesis or
  // case carries the shell's word past the end the rule reads. The && then
  // sits inside that word, and the merge after the ; or the newline runs
  // ungated (#710).
  'argument, escaped quote': 'scripts/wait-e2e-slot.sh "a\\" && x"; ' + MERGE,
  'argument, quoted subst': 'scripts/wait-e2e-slot.sh "$(echo " && x")"; ' + MERGE,
  'argument, backtick': 'scripts/wait-e2e-slot.sh `x && y`; ' + MERGE,
  'argument, quoted backtick, double quotes': 'scripts/wait-e2e-slot.sh "`echo " && x"`"; ' + MERGE,
  'argument, braced parameter': 'scripts/wait-e2e-slot.sh "${a:-" && x"}"; ' + MERGE,
  'argument, comment': 'scripts/wait-e2e-slot.sh #a && x\n' + MERGE,
  'argument, quote inside': 'scripts/wait-e2e-slot.sh a" && x"; ' + MERGE,
  'argument, single quote inside': "scripts/wait-e2e-slot.sh a' && x'; " + MERGE,
  'subst, escaped quote in an inner string':
    'scripts/wait-e2e-slot.sh "$(echo "\\")" && x ")")"; ' + MERGE,
  'subst, backtick in an inner string':
    'scripts/wait-e2e-slot.sh "$(echo "`echo ")" && x`")"; ' + MERGE,
  'subst, subst in an inner string':
    'scripts/wait-e2e-slot.sh "$(echo "$(echo ")" && x ")")")"; ' + MERGE,
  'subst, braced parameter in an inner string':
    'scripts/wait-e2e-slot.sh "$(echo "${a:-")" && x }")"; ' + MERGE,
  'unquoted subst, && inside': 'scripts/wait-e2e-slot.sh $(echo && x); ' + MERGE,
  'subst, comment': 'scripts/wait-e2e-slot.sh "$(echo # )" && x\n)"; ' + MERGE,
  'subst, here-document': 'scripts/wait-e2e-slot.sh "$(cat <<E\n)" && x\nE\n)"; ' + MERGE,
  'subst, single-quoted string': 'scripts/wait-e2e-slot.sh "$(echo \')" && x \')"; ' + MERGE,
  'subst, escaped parenthesis': 'scripts/wait-e2e-slot.sh "$(echo \\)" && x ")"; ' + MERGE,
  'subst, backtick': 'scripts/wait-e2e-slot.sh "$(echo `)" && x `)"; ' + MERGE,
  'subst, braced parameter': 'scripts/wait-e2e-slot.sh "$(echo ${a:-)" && x "})"; ' + MERGE,
  'subst, process substitution': 'scripts/wait-e2e-slot.sh "$(echo >(cat )" && x ")"; ' + MERGE,
  'argument, process substitution': 'scripts/wait-e2e-slot.sh <(echo && x); ' + MERGE,
  'argument, nested braced parameter': 'scripts/wait-e2e-slot.sh ${a:-${b} && x}; ' + MERGE,
  'argument, quoted nested braced parameter':
    'scripts/wait-e2e-slot.sh "${a:-${b}" && x "}"; ' + MERGE,
  'subst, nested braced parameter':
    'scripts/wait-e2e-slot.sh "$(echo ${a:-${b})" && x "})"; ' + MERGE,
  'unquoted subst, nested braced parameter':
    'scripts/wait-e2e-slot.sh $(echo${a:-${b}) && x}); ' + MERGE,
  'unquoted subst, quote inside': 'scripts/wait-e2e-slot.sh $(echo") && x "); ' + MERGE,
  'unquoted subst, single quote inside': "scripts/wait-e2e-slot.sh $(echo') && x '); " + MERGE,
  'unquoted subst, escaped parenthesis': 'scripts/wait-e2e-slot.sh $(echo\\) && x ); ' + MERGE,
  'unquoted subst, backtick': 'scripts/wait-e2e-slot.sh $(echo`) && x `); ' + MERGE,
  'unquoted subst, process substitution': 'scripts/wait-e2e-slot.sh $(echo>(cat) && x); ' + MERGE,
  'unquoted subst, comment': 'scripts/wait-e2e-slot.sh $(#) && x\n); ' + MERGE,
  // A case pattern's ) does not end the "$(…)".
  'subst, case pattern': 'scripts/wait-e2e-slot.sh "$(case x in x)" && y" ;; esac)"; ' + MERGE,
  'subst, case pattern after a blank':
    'scripts/wait-e2e-slot.sh "$( case x in x)" && y" ;; esac)"; ' + MERGE,
  'subst, case pattern after ;':
    'scripts/wait-e2e-slot.sh "$(true;case x in x)" && y" ;; esac)"; ' + MERGE,
  'subst, case pattern after &&':
    'scripts/wait-e2e-slot.sh "$(true&&case x in x)" && y" ;; esac)"; ' + MERGE,
  'subst, case pattern after |':
    'scripts/wait-e2e-slot.sh "$(true|case x in x)" && y" ;; esac)"; ' + MERGE,
  // Only zsh hides the && in these two: it reads {case as { and the
  // keyword, and &! as an operator (run in the background and disown).
  // bash reads {case and !case as command names and ends the "$(…)" at the
  // first ), so its && is real, but bash still runs the merge after the ;,
  // which ends the chain (#715).
  'subst, case pattern after {':
    'scripts/wait-e2e-slot.sh "$({case x in x)" && y" ;; esac;})"; ' + MERGE,
  'subst, case pattern after &!':
    'scripts/wait-e2e-slot.sh "$(true&!case x in x)" && y" ;; esac)"; ' + MERGE,
  // Both shells end the argument at its closing quote and run the merge
  // after the first ;. A "…" branch that read past that quote would take
  // "a"; MERGE; "b" as the argument, and the && after it as the slot call's.
  'two quoted arguments, merge between': 'scripts/wait-e2e-slot.sh "a"; ' + MERGE + '; "b" && x',
  // The shell ends the argument there, so the && gates the command after
  // the ;, the pipe or the &.
  'SHA then semicolon, no blank': 'scripts/wait-e2e-slot.sh c2403f8;true && ' + MERGE,
  'SHA piped, no blanks': 'scripts/wait-e2e-slot.sh c2403f8|cat && ' + MERGE,
  'SHA in the background': 'scripts/wait-e2e-slot.sh c2403f8&true && ' + MERGE
};

// Only zsh runs the merge: bash refuses the whole command.
const START_IN_ZSH_ONLY: Record<string, string> = {
  'argument, $[': 'scripts/wait-e2e-slot.sh "$[1" && "2]"; ' + MERGE
};

// Only bash runs the merge: zsh stops on a parse error before the slot
// script runs.
const START_IN_BASH_ONLY: Record<string, string> = {
  'quoted backtick, escaped backtick': 'scripts/wait-e2e-slot.sh "`echo \\`" && x `"; ' + MERGE,
  'quoted backtick, three backticks': 'scripts/wait-e2e-slot.sh "`a`b`" && x `"; ' + MERGE
};

// No shell runs the start command after these: the && gates it, or the
// shell refuses the command. The rule blocks them by decision.
const START_IN_NO_SHELL: Record<string, string> = {
  // The group's ; ends the chain as the rule reads it (#715). The message
  // sends it to a plain && chain.
  'brace group after the slot call':
    'scripts/wait-e2e-slot.sh && { T=$(cat k); curl -X POST "$API/actions/jobs/13858/rerun"; }',
  // Quotes inside a "$(…)": #651 let these through, #710 sends them to the
  // variable form.
  'rev-parse, inner quotes': INNER_QUOTES + ' && ' + MERGE,
  'curl | jq, inner quotes':
    'scripts/wait-e2e-slot.sh "$(curl -s "$API/pulls/640" | jq -r .head.sha)" && ' + MERGE,
  'continuation, subst':
    'scripts/wait-e2e-slot.sh \\\n  "$(git rev-parse "origin/$B")" && ' + MERGE,
  'subst, two levels':
    'scripts/wait-e2e-slot.sh "$(git rev-parse "origin/$(git branch --show-current)")" && ' + MERGE,
  'subst, three levels': 'scripts/wait-e2e-slot.sh "$(a "$(b "c")")" && ' + MERGE,
  'subst, single quotes inside':
    'scripts/wait-e2e-slot.sh "$(curl -s "$API/pulls/640" | jq -r \'.head.sha\')" && ' + MERGE,
  'subst, redirect': INNER_QUOTES + ' > /tmp/slot.out 2>&1 && ' + MERGE,
  // Each holds one character the argument group refuses.
  'subst, ) inside': 'scripts/wait-e2e-slot.sh "$(echo a)b)" && ' + MERGE,
  'subst, [ inside': 'scripts/wait-e2e-slot.sh "$(echo $a[1])" && ' + MERGE,
  'string, [ inside': 'scripts/wait-e2e-slot.sh "$a[1]" && ' + MERGE,
  'argument, ) inside': 'scripts/wait-e2e-slot.sh a)b && ' + MERGE,
  'argument, [ inside': 'scripts/wait-e2e-slot.sh $a[1] && ' + MERGE,
  'argument, backslash': 'scripts/wait-e2e-slot.sh a\\b && ' + MERGE,
  'unquoted subst, ) inside': 'scripts/wait-e2e-slot.sh $(echo)a) && ' + MERGE,
  'unquoted subst, < inside': 'scripts/wait-e2e-slot.sh $(cat<x) && ' + MERGE,
  'unquoted subst, [ inside': 'scripts/wait-e2e-slot.sh $(echo$a[1]) && ' + MERGE,
  'unquoted subst, && inside, no blank': 'scripts/wait-e2e-slot.sh $(a&&b) && ' + MERGE,
  'unquoted subst, ; inside': 'scripts/wait-e2e-slot.sh $(a;b) && ' + MERGE,
  'unquoted subst, | inside': 'scripts/wait-e2e-slot.sh $(a|b) && ' + MERGE
};

// Each group with the shells that run its start command.
const SHELL_GROUPS: [string, Record<string, string>, readonly string[]][] = [
  ['both shells', START_IN_BOTH_SHELLS, ['bash', 'zsh']],
  ['zsh only', START_IN_ZSH_ONLY, ['zsh']],
  ['bash only', START_IN_BASH_ONLY, ['bash']],
  ['no shell', START_IN_NO_SHELL, []]
];

// A slot call that gates nothing, or that the rule cannot read.
const MUST_BLOCK: Record<string, string> = {
  piped: 'scripts/wait-e2e-slot.sh | tail -1; ' + MERGE,
  'piped then &&': 'scripts/wait-e2e-slot.sh | tail -1 && ' + MERGE,
  semicolon: 'scripts/wait-e2e-slot.sh; ' + MERGE,
  'semicolon, later &&': 'scripts/wait-e2e-slot.sh; ' + MERGE + ' && echo ok',
  'SHA then semicolon': 'scripts/wait-e2e-slot.sh c2403f8; ' + MERGE,
  'SHA then ||': 'scripts/wait-e2e-slot.sh c2403f8 || true; ' + MERGE,
  '||': 'scripts/wait-e2e-slot.sh || ' + MERGE,
  '||, later &&': 'scripts/wait-e2e-slot.sh || ' + MERGE + ' && echo ok',
  'SHA ||, later &&': 'scripts/wait-e2e-slot.sh c2403f8 || ' + MERGE + ' && echo ok',
  'newline then &&': 'scripts/wait-e2e-slot.sh\ntrue && ' + MERGE,
  'SHA, newline then &&': 'scripts/wait-e2e-slot.sh c2403f8\ntrue && ' + MERGE,
  'newline before &&': 'scripts/wait-e2e-slot.sh\n&& ' + MERGE,
  'subst then semicolon, later &&': SUBST + '; ' + MERGE + ' && echo ok',
  'subst piped then &&': SUBST + ' | tail -1 && ' + MERGE,
  'subst piped, later &&': SUBST + ' | tail -1; ' + MERGE + ' && echo ok',
  'subst then ||': SUBST + ' || ' + MERGE,
  'subst ||, later &&': SUBST + ' || ' + MERGE + ' && echo ok',
  'subst, newline then &&': SUBST + '\ntrue && ' + MERGE,
  'subst, two arguments': SUBST + ' x && ' + MERGE,
  'unclosed subst': 'scripts/wait-e2e-slot.sh "$(git rev-parse "origin/$B" && ' + MERGE,
  // The message names these forms and sends them to the variable form.
  'subst, escaped quote': 'scripts/wait-e2e-slot.sh "$(git rev-parse \\"origin/$B\\")" && ' + MERGE,
  'subst, bare parentheses':
    'scripts/wait-e2e-slot.sh "$( (cd /w && git rev-parse "origin/$B") )" && ' + MERGE,
  'unquoted subst': 'scripts/wait-e2e-slot.sh $(git rev-parse origin/x) && ' + MERGE,
  'unquoted subst, inner quotes':
    'scripts/wait-e2e-slot.sh $(git rev-parse "origin/$B") && ' + MERGE,
  'backtick, unquoted': 'scripts/wait-e2e-slot.sh `git rev-parse origin/x` && ' + MERGE,
  'backtick, unquoted, double quotes':
    'scripts/wait-e2e-slot.sh `git rev-parse "origin/$B"` && ' + MERGE,
  'backtick, quoted, double quotes':
    'scripts/wait-e2e-slot.sh "`git rev-parse "origin/$B"`" && ' + MERGE,
  ...Object.assign({}, ...SHELL_GROUPS.map(([, cases]) => cases)),
  // A pipe hands && the exit status of its last command, not the script's.
  'redirect piped then &&': 'scripts/wait-e2e-slot.sh 2>&1 | tail -1 && ' + MERGE,
  'redirect to a file piped then &&':
    'scripts/wait-e2e-slot.sh > /tmp/slot.out | tail -1 && ' + MERGE,
  'redirect then semicolon': 'scripts/wait-e2e-slot.sh > /tmp/slot.out; ' + MERGE,
  'redirect then rc=$?':
    'scripts/wait-e2e-slot.sh > /tmp/slot.out 2>&1; rc=$?; if [ $rc -eq 0 ]; then ' +
    MERGE +
    '; fi',
  'redirect then ||': 'scripts/wait-e2e-slot.sh > /tmp/slot.out || ' + MERGE,
  'redirect, newline then &&': 'scripts/wait-e2e-slot.sh > /tmp/slot.out\ntrue && ' + MERGE,
  'redirect before the SHA': 'scripts/wait-e2e-slot.sh > /tmp/slot.out c2403f8 && ' + MERGE,
  // The rule reads output redirects only.
  '>|': 'scripts/wait-e2e-slot.sh >| /tmp/slot.out && ' + MERGE,
  'process substitution': 'scripts/wait-e2e-slot.sh > >(tee /tmp/slot.out) && ' + MERGE,
  'input redirect': 'scripts/wait-e2e-slot.sh < /dev/null && ' + MERGE,
  'here-string': 'scripts/wait-e2e-slot.sh <<< x && ' + MERGE,
  // A target that took in a backslash, a $ or a backtick inside "…", or a
  // quote or backtick outside it, would end before the shell's word does.
  // The && then sits inside that word, and the merge after ; runs ungated.
  'target, escaped quote': 'scripts/wait-e2e-slot.sh > "a\\" && x"; ' + MERGE,
  'target, quoted subst': 'scripts/wait-e2e-slot.sh > "$(echo " && x")"; ' + MERGE,
  'target, backtick': 'scripts/wait-e2e-slot.sh > `echo && x`; ' + MERGE,
  'target, quoted backtick': 'scripts/wait-e2e-slot.sh > "`echo " && x"`"; ' + MERGE,
  'target, quote inside': 'scripts/wait-e2e-slot.sh > /tmp/a" && x"; ' + MERGE,
  'target, single quote inside': "scripts/wait-e2e-slot.sh > /tmp/a' && x'; " + MERGE,
  // The shell ends the target's word there, so the && gates the command
  // after the pipe, the semicolon or the &, and the redirect on the new line.
  'redirect piped, no blanks': 'scripts/wait-e2e-slot.sh > /tmp/slot.out|cat && ' + MERGE,
  'redirect then semicolon, no blank': 'scripts/wait-e2e-slot.sh > /tmp/slot.out;true && ' + MERGE,
  'redirect in the background': 'scripts/wait-e2e-slot.sh > /tmp/slot.out&true && ' + MERGE,
  'newline, then a redirect and &&': 'scripts/wait-e2e-slot.sh\n2>&1 && ' + MERGE,
  // hookify matches the pattern with re.IGNORECASE, the marker with a
  // case-sensitive substring test.
  'upper case': 'FJ PR MERGE 640',
  'upper-case marker': MERGE + '  # NO-E2E-JOB'
};

// A slot call chained with && on one shell line, and commands that start
// nothing.
const MUST_PASS: Record<string, string> = {
  'two lines': 'scripts/wait-e2e-slot.sh c2403f8 &&\n' + MERGE,
  tab: 'scripts/wait-e2e-slot.sh\tc2403f8\t&& ' + MERGE,
  continuation: 'scripts/wait-e2e-slot.sh \\\n&& ' + MERGE,
  'SHA, continuation': 'scripts/wait-e2e-slot.sh c2403f8 \\\n  && ' + MERGE,
  'continuation, SHA': 'scripts/wait-e2e-slot.sh \\\n  c2403f8 && ' + MERGE,
  // One shell line: the script refuses `true` with exit 2, so the merge
  // stays gated.
  'continuation, word': 'scripts/wait-e2e-slot.sh \\\ntrue && ' + MERGE,
  'continuation, plain subst':
    'scripts/wait-e2e-slot.sh \\\n  "$(git rev-parse origin/x)" && ' + MERGE,
  'plain subst, redirect inside':
    'scripts/wait-e2e-slot.sh "$(git rev-parse origin/x 2>/dev/null)" && ' + MERGE,
  // case is a keyword only where a command starts.
  'subst, a word ending in case':
    'scripts/wait-e2e-slot.sh "$(git rev-parse origin/fix-case 2>/dev/null)" && ' + MERGE,
  'braced variable': 'scripts/wait-e2e-slot.sh "${H}" && ' + MERGE,
  'unquoted variable': 'scripts/wait-e2e-slot.sh $H && ' + MERGE,
  'empty subst': 'scripts/wait-e2e-slot.sh "$()" && ' + MERGE,
  'unquoted subst, no blank': 'scripts/wait-e2e-slot.sh $(cat) && ' + MERGE,
  'backtick, quoted': 'scripts/wait-e2e-slot.sh "`git rev-parse origin/x`" && ' + MERGE,
  'backtick, quoted, single quotes':
    'scripts/wait-e2e-slot.sh "`git rev-parse \'origin/x\'`" && ' + MERGE,
  'variable first': 'H=$(git rev-parse "origin/$B") && scripts/wait-e2e-slot.sh "$H" && ' + MERGE,
  "message's variable form":
    'H=$(git rev-parse origin/x) && scripts/wait-e2e-slot.sh "$H" && ' + MERGE,
  // Output redirects after the argument keep the script's exit status.
  'redirect to a file': 'scripts/wait-e2e-slot.sh > /tmp/slot.out && ' + MERGE,
  'redirect 2>&1': 'scripts/wait-e2e-slot.sh 2>&1 && ' + MERGE,
  'variable, redirect':
    'H=$(git rev-parse origin/x) && scripts/wait-e2e-slot.sh "$H" > /tmp/slot.out && ' + MERGE,
  'redirect, no blank': 'scripts/wait-e2e-slot.sh >/tmp/slot.out && ' + MERGE,
  'stderr to /dev/null': 'scripts/wait-e2e-slot.sh 2>/dev/null && ' + MERGE,
  'SHA, redirect, no blank': 'scripts/wait-e2e-slot.sh c2403f8 >/tmp/slot.out && ' + MERGE,
  'SHA, stderr to a file': 'scripts/wait-e2e-slot.sh c2403f8 2> /tmp/slot.err && ' + MERGE,
  append: 'scripts/wait-e2e-slot.sh >> /tmp/slot.out 2>&1 && ' + MERGE,
  '&>': 'scripts/wait-e2e-slot.sh &> /tmp/slot.out && ' + MERGE,
  '&>>': 'scripts/wait-e2e-slot.sh &>>/tmp/slot.out && ' + MERGE,
  '>&2': 'scripts/wait-e2e-slot.sh >&2 && ' + MERGE,
  'double-quoted target': 'scripts/wait-e2e-slot.sh > "/tmp/slot out.log" && ' + MERGE,
  'single-quoted target': "scripts/wait-e2e-slot.sh 2>> '/tmp/slot out.log' && " + MERGE,
  'plain subst, redirect':
    'scripts/wait-e2e-slot.sh "$(git rev-parse origin/x)" > /tmp/slot.out 2>&1 && ' + MERGE,
  'SHA, redirect, continuations':
    'scripts/wait-e2e-slot.sh c2403f8 \\\n  > /tmp/slot.out 2>&1 \\\n  && ' + MERGE,
  // The start command in the slot call's && chain (#715). A pipe binds
  // tighter than &&, so the pipeline runs only once the slot call succeeds.
  'chained through a pipe': 'scripts/wait-e2e-slot.sh && git push 2>&1 | tail -3 && ' + MERGE,
  'chained over two lines': 'scripts/wait-e2e-slot.sh && git push &&\n' + MERGE,
  'chained, &> and 2>&1':
    'scripts/wait-e2e-slot.sh && git push &>/tmp/p.out && git fetch 2>&1 && ' + MERGE,
  '|| after the start': 'scripts/wait-e2e-slot.sh && ' + MERGE + ' || echo failed',
  'list before the slot call': 'cd /w; git fetch -q\nscripts/wait-e2e-slot.sh && ' + MERGE,
  'two starts, one chain':
    'scripts/wait-e2e-slot.sh && ' + MERGE + ' && fj pr -R origin merge 641 -d',
  'list after the start': 'scripts/wait-e2e-slot.sh && ' + MERGE + '; echo done',
  subshell: '(scripts/wait-e2e-slot.sh && ' + MERGE + ')',
  'test with ! before the chain': '[ ! -f x ] && scripts/wait-e2e-slot.sh && ' + MERGE,
  'test with != before the chain': '[ "$a" != b ] && scripts/wait-e2e-slot.sh && ' + MERGE,
  "message's chain form":
    'scripts/wait-e2e-slot.sh && T=$(cat k) && curl -X POST "$API/actions/jobs/13858/rerun"',
  // A || or a negation reaches no further than the end of its own list.
  '|| in an earlier list': 'true || echo x; scripts/wait-e2e-slot.sh && ' + MERGE,
  '|| in an earlier line': 'true || echo x\nscripts/wait-e2e-slot.sh && ' + MERGE,
  '|| in an earlier list sent to the background':
    'true || echo x & scripts/wait-e2e-slot.sh && ' + MERGE,
  '! in an earlier list': '! true; scripts/wait-e2e-slot.sh && ' + MERGE,
  '! in an earlier line': '! true\nscripts/wait-e2e-slot.sh && ' + MERGE,
  '! in an earlier list sent to the background': '! true & scripts/wait-e2e-slot.sh && ' + MERGE,
  'negated slot call in an earlier list':
    '! scripts/wait-e2e-slot.sh; scripts/wait-e2e-slot.sh && ' + MERGE,
  'negated slot call in an earlier line':
    '! scripts/wait-e2e-slot.sh\nscripts/wait-e2e-slot.sh && ' + MERGE,
  'negated slot call sent to the background':
    '! scripts/wait-e2e-slot.sh & scripts/wait-e2e-slot.sh && ' + MERGE,
  'negated slot call sent to the background, no blank':
    '! scripts/wait-e2e-slot.sh& scripts/wait-e2e-slot.sh && ' + MERGE,
  // Another repo's job, named in the URL: no diversif E2E job starts.
  'rerun in another repo':
    'curl -X POST https://git.sbrn.eu/api/v1/repos/simonbrunou/cinder/actions/jobs/13858/rerun',
  push: 'git push -q origin HEAD',
  search: 'fj pr -R origin search',
  status: 'fj pr -R origin status 642'
};

// Each clause of the message's sentences on the arguments the rule reads,
// in their order, with the text that follows it there, arguments it says
// pass and arguments it says block. A probe is
// `scripts/wait-e2e-slot.sh <argument> && <merge>`. The message must hold
// exactly these clauses between « so the rule blocks it. It reads only these
// arguments: » and « Any other argument blocks. For those arguments, », the
// sentences on either side. An edit to the pattern that flips a probe,
// or to those sentences that adds, drops or changes a clause, fails a test,
// so the two change together (#710's review found the message overstating
// what blocks).
const ARGUMENT_CLAIMS: {
  clause: string;
  followedBy: string;
  passes: string[];
  blocks: string[];
}[] = [
  {
    clause:
      'an unquoted word, such as a SHA, with no quote, `\\`, `#`, `[`, backtick or parenthesis',
    followedBy: ', ',
    passes: ['c2403f8', 'x/y-z.w'],
    blocks: ['a"b"', "a'b'", 'a\\b', 'a#b', 'a[1]', 'a`b`', 'a(b', 'a)b']
  },
  {
    clause:
      'other than the parentheses of a `$(…)` in it with no blank, quote, `\\`, backtick, parenthesis, `#`, `<`, `[`, `&`, `;` or `|` inside',
    followedBy: '; ',
    passes: ['$(cat)', '$(git)', 'a$(cat)b', '$(cat)$(cat)', '$H$(cat)'],
    blocks: [
      '$(echo x)',
      'a$(echo x)b',
      '$(echo"x")',
      "$(echo'x')",
      'a$(b"c")',
      '$(echo\\x)',
      '$(echo`x`)',
      '$((x))',
      '$(a(b)',
      '$(echo)x)',
      '$(#)',
      '$(cat<x)',
      '$(echo[x])',
      '$(a&b)',
      '$(a;b)',
      '$(a|b)'
    ]
  },
  { clause: "a `'…'`", followedBy: '; ', passes: ["'a#b\\c$(d)`e[f\"'"], blocks: [] },
  {
    clause: 'a `"…"` with no `\\`, `[` or backtick',
    followedBy: '; ',
    passes: ['"a # b"', '"$H/$1x"'],
    blocks: ['"a\\b"', '"a[1]"', '"a`b`"']
  },
  {
    clause: 'a `"$(…)"` with no quote, `\\`, backtick, parenthesis, `#`, `<` or `[` inside',
    followedBy: ', ',
    passes: [
      '"$()"',
      '"$(git rev-parse origin/$B)"',
      '"$(git rev-parse origin/x 2>/dev/null)"',
      '"$(curl -s $API/pulls/640 | jq -r .head.sha)"'
    ],
    blocks: [
      '"$(echo "x")"',
      '"$(echo \'x\')"',
      '"$(echo \\x)"',
      '"$(echo `x`)"',
      '"$( (x) )"',
      '"$(a (b)"',
      '"$(echo x)y)"',
      '"$(echo #)"',
      '"$(cat <x)"',
      '"$(echo [x])"'
    ]
  },
  {
    clause:
      'and no `case` with a blank after it that starts the `$(…)` or follows a blank, `;`, `&`, `|`, `{` or `!`',
    followedBy: '; and ',
    passes: [
      '"$(echo case)"',
      '"$(echo showcase x)"',
      '"$(echo fix-case x)"',
      // A ; would end the chain (#715): | stands in for it.
      '"$(echo case|true)"',
      '"$(echo x|case)"'
    ],
    blocks: [
      '"$(case x)"',
      '"$(echo case x)"',
      '"$(echo\tcase\tx)"',
      '"$(x;case y)"',
      '"$(x&case y)"',
      '"$(x|case y)"',
      '"$(echo {case x)"',
      '"$(echo !case x)"'
    ]
  },
  {
    clause: 'a `` "`…`" `` with no `"`, `\\` or other backtick inside',
    followedBy: '. ',
    passes: ['"`git rev-parse origin/x`"', '"`echo $(x) ${a:-b} \'c\' # d`"'],
    blocks: ['"`echo "x"`"', '"`echo \\x`"', '"`a`b`c`"']
  },
  {
    clause:
      'Outside `\'…\'` and `` "`…`" ``, each `$` must start a plain variable, such as `$H`, `$1` or `${H}`, or one of the two `$(…)` forms',
    followedBy: '. ',
    passes: ['$H', '${H}', 'a$H', '"$H"', '"${H}"', '"$1"'],
    blocks: ['${a:-x}', '"${a:-x}"', '$$', '"$?"', '$@x', '"$(echo ${a:-x})"', '$(echo$$)']
  },
  {
    clause:
      'In every form, a `;`, a `||`, a lone `&` or a newline blocks: each ends the chain, as the next paragraph says',
    followedBy: '. ',
    passes: ['"a && b"', "'a | b'", '"$(a && b | c)"', '"`a && b`"', "'a &> b 2>&1'"],
    blocks: [
      "'a;b'",
      '"a;b"',
      '"$(a;b)"',
      '"`a;b`"',
      "'a||b'",
      '"$(a||b)"',
      "'a&b'",
      '"$(a & b)"',
      '"`a&b`"',
      "'a\nb'",
      '"$(a\nb)"'
    ]
  }
];
const slotCall = (argument: string) => 'scripts/wait-e2e-slot.sh ' + argument + ' && ' + MERGE;
const CLAIM_PROBES = ARGUMENT_CLAIMS.flatMap(({ clause, passes, blocks }) => [
  ...passes.map((argument) => [clause, argument, false] as const),
  ...blocks.map((argument) => [clause, argument, true] as const)
]);

const COMMANDS = [
  ...[...STARTS, ...BLOCK_STARTS].flatMap((start) => [
    start,
    start + '  # no-e2e-job',
    ...Object.values(SLOTS).map((slot) => slot + start)
  ]),
  ...Object.values(MUST_BLOCK),
  ...Object.values(MUST_PASS),
  ...CLAIM_PROBES.map(([, argument]) => slotCall(argument))
];

// The hook's answer to every case, from one Python process.
const answers = respondAll(COMMANDS.map((command) => preToolUse('Bash', { command })));
const verdicts = new Map(COMMANDS.map((command, i) => [command, answers[i]]));
const blocks = (command: string) => {
  if (!verdicts.has(command)) throw new Error(`not in COMMANDS: ${command}`);
  return denies(verdicts.get(command));
};

describe('block-e2e-start-without-slot', () => {
  it("loads with the hook's own loader", () => {
    expect(rule).toMatchObject({
      name: RULE,
      enabled: true,
      event: 'bash',
      action: 'block'
    });
    expect(rule.conditions.map((c) => [c.field, c.operator])).toEqual([
      ['command', 'regex_match'],
      ['command', 'not_contains']
    ]);
    expect(rule.conditions[1].pattern).toBe('# no-e2e-job');
  });

  describe.each(STARTS)('%s', (start) => {
    it('blocks bare', () => expect(blocks(start)).toBe(true));
    it('passes with the marker', () => expect(blocks(start + '  # no-e2e-job')).toBe(false));
    it.each(Object.entries(SLOTS))('passes behind the slot check: %s', (_, slot) =>
      expect(blocks(slot + start)).toBe(false)
    );
  });

  describe.each(BLOCK_STARTS)('%s', (start) => {
    it('blocks bare', () => expect(blocks(start)).toBe(true));
    it('passes with the marker', () => expect(blocks(start + '  # no-e2e-job')).toBe(false));
    it.each(Object.entries(SLOTS))('blocks behind the slot check: %s', (_, slot) =>
      expect(blocks(slot + start)).toBe(true)
    );
  });

  it.each(Object.entries(MUST_BLOCK))('blocks: %s', (_, command) =>
    expect(blocks(command)).toBe(true)
  );

  it.each(Object.entries(MUST_PASS))('passes: %s', (_, command) =>
    expect(blocks(command)).toBe(false)
  );

  // A nested quantifier in the argument group backtracks without end on an
  // argument that never closes: hookify ran over 120 s on such a mutant.
  // The same goes for a long run of redirects that never reaches &&. Claude
  // Code stops a hook after its 10 s timeout and runs the call, so each case
  // runs the hook in a process of its own with the same 10 s limit; a hook
  // stopped there gives no answer, and the test fails.
  const unclosed = (body: string) => 'scripts/wait-e2e-slot.sh "$(' + body + ' && ' + MERGE;
  const redirects = (redirect: string) =>
    'scripts/wait-e2e-slot.sh' + redirect.repeat(5_000) + '; ' + MERGE;
  it.each([
    ['plain', unclosed('a'.repeat(20_000))],
    ['quoted strings', unclosed('"x"'.repeat(7_000))],
    ['nested openings', unclosed('a"$(b'.repeat(4_000))],
    // The case lookahead scans to the end of the text and tries each blank.
    ['blanks', unclosed(' a'.repeat(10_000))],
    ['variables, quoted', 'scripts/wait-e2e-slot.sh "' + '$H'.repeat(10_000) + ' && ' + MERGE],
    ['variables, unquoted', 'scripts/wait-e2e-slot.sh ' + '$H'.repeat(10_000) + '; ' + MERGE],
    ['5,000 redirects 2>&1, no &&', redirects(' 2>&1')],
    ['5,000 redirects to a file, no &&', redirects(' >> /tmp/slot.out')]
  ])(
    'blocks an unclosed 20,000-character argument: %s',
    (_, command) => expect(denies(runHook(preToolUse('Bash', { command })).output)).toBe(true),
    15_000
  );

  // The rule reads each list once, from its start to its end, a gated slot
  // call or a start command (#715), so these finish within the default test
  // timeout.
  const afterSlot = (link: string) => 'scripts/wait-e2e-slot.sh && ' + link.repeat(10_000) + MERGE;
  it.each([
    ['x; ', afterSlot('x; ')],
    ['x || ', afterSlot('x || ')],
    ['x and a newline', afterSlot('x\n')],
    ['x & ', afterSlot('x & ')],
    ['10,000 slot calls, then x; ', 'scripts/wait-e2e-slot.sh && '.repeat(10_000) + 'x; ' + MERGE]
  ])('blocks a start after 10,000 links that end the chain: %s', (_, command) =>
    expect(denies(runHook(preToolUse('Bash', { command })).output)).toBe(true)
  );

  it('passes a start after 10,000 && links', () =>
    expect(denies(runHook(preToolUse('Bash', { command: afterSlot('x && ') })).output)).toBe(
      false
    ));

  // Long commands with no start command. Python's re searches each to its
  // end, so a check that read on past a list end, a || or a negated slot
  // call, or a negation that read past a list end or a !, would take time
  // that grows with the square of the length. The search is timed inside
  // Python, without the process start-up.
  it.each([
    ['x || ', 'x || '.repeat(10_000) + 'echo'],
    ['! scripts/wait-e2e-slot.sh && ', '! scripts/wait-e2e-slot.sh && '.repeat(5_000) + 'echo'],
    ['! x ', '! x '.repeat(10_000)],
    ['x; ', 'x; '.repeat(10_000) + 'echo'],
    ['x and a newline', 'x\n'.repeat(10_000) + 'echo'],
    ['x & ', 'x & '.repeat(10_000) + 'echo']
  ])(
    'passes a long command with no start command within 500 ms: %s',
    (_, command) => {
      expect(denies(runHook(preToolUse('Bash', { command })).output)).toBe(false);
      const [seconds] = searchSeconds(rule.conditions[0].pattern, [command]);
      expect(seconds).toBeLessThan(0.5);
    },
    15_000
  );

  it('names the variable form in its message', () =>
    expect(rule.message).toContain(
      '`H=$(git rev-parse origin/<branch>) && scripts/wait-e2e-slot.sh "$H" && <command>`'
    ));

  it('names the pipe as the form that blocks, not a redirect', () => {
    expect(rule.message).toContain('It never lets a pipe through.');
    expect(rule.message).not.toContain('drop it');
  });

  // #715: the ends of the chain, the forms they block, the rewrite and the
  // marker's reach.
  it.each([
    'These end the chain: a `;`, a `||`, a lone `&` (one outside `&&`, `>&`, `&>` and `|&`), ' +
      'and a newline that ends a line with text on it, unless that line ends in `&&`, `|` or `\\`.',
    'So a loop or an `if` after the slot call blocks, and so does a `{ … }` group',
    'write a plain `&&` chain instead, such as `scripts/wait-e2e-slot.sh && T=$(…) && curl …`',
    'A negated slot call',
    'The comment turns the rule off for the whole call, an E2E start in it included'
  ])('says in its message: %s', (text) => expect(rule.message).toContain(text));

  it.each([
    [
      '`scripts/wait-e2e-slot.sh && git push 2>&1 | tail -3 && <command>`',
      MUST_PASS['chained through a pipe'],
      false
    ],
    [
      '`true || scripts/wait-e2e-slot.sh && <command>`',
      MUST_BLOCK['|| before the slot call'],
      true
    ],
    ['`scripts/wait-e2e-slot.sh && T=$(…) && curl …`', MUST_PASS["message's chain form"], false],
    ['`! scripts/wait-e2e-slot.sh && <command>`', MUST_BLOCK['negated slot call'], true]
  ])('reads the example in its message as the message says: %s', (example, command, blocked) => {
    expect(rule.message).toContain(example);
    expect(blocks(command)).toBe(blocked);
  });

  it.each(ARGUMENT_CLAIMS.map(({ clause }) => clause))('names in its message: %s', (clause) =>
    expect(rule.message).toContain(clause)
  );

  it('lists exactly those clauses as the arguments it reads', () =>
    expect(rule.message).toContain(
      'so the rule blocks it. It reads only these arguments: ' +
        ARGUMENT_CLAIMS.map(({ clause, followedBy }) => clause + followedBy).join('') +
        'Any other argument blocks. For those arguments,'
    ));

  it.each(CLAIM_PROBES)('reads an argument as its message says (%s): %s', (_, argument, blocked) =>
    expect(blocks(slotCall(argument))).toBe(blocked)
  );
});

// The #710 and #715 cases, each MUST_PASS case with a slot call and each
// slot form, run in a shell from a directory where scripts/wait-e2e-slot.sh
// exits with $SLOT_EXIT, fj prints STARTED for a merge, curl prints STARTED
// for a rerun or a merge URL, nix develop runs the command after its -c, and
// git and jq print nothing. A /tmp/ path in a command points into that
// directory, and so do zsh's here-document files (TMPPREFIX) and a cd /w.
// So a case runs as it would in the repo, with no forge call, no merge and
// no file outside the directory. The CI image has no zsh, so CI checks the
// bash half only.
describe('the #710 and #715 cases in a shell', () => {
  const sandbox = mkdtempSync(path.join(tmpdir(), 'e2e-slot-rule-'));
  const write = (file: string, body: string) => {
    mkdirSync(path.dirname(path.join(sandbox, file)), { recursive: true });
    writeFileSync(path.join(sandbox, file), body, { mode: 0o755 });
  };
  const stub = (file: string, body: string) => write(file, '#!/bin/sh\n' + body + '\n');
  stub('scripts/wait-e2e-slot.sh', 'exit "$SLOT_EXIT"');
  stub('bin/fj', 'case "$*" in *merge*) echo STARTED ;; esac');
  stub('bin/curl', 'case "$*" in */rerun*|*/merge*) echo STARTED ;; esac');
  // nix develop [<flake>] -c|--command <command>...
  stub('bin/nix', 'shift; case "$1" in -c|--command) ;; *) shift ;; esac; shift; exec "$@"');
  for (const tool of ['git', 'jq']) stub('bin/' + tool, 'exit 0');
  // The token file the slot form after cd and T= reads.
  write('k', 'token\n');
  afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

  const GROUP_CASES = SHELL_GROUPS.flatMap(([group, cases, shells]) =>
    Object.entries(cases).map(([name, command]) => ({ group, name, command, shells }))
  );
  const PASSING = [
    ...Object.entries(MUST_PASS).filter(([, command]) => command.includes('wait-e2e-slot.sh')),
    ...Object.entries(SLOTS).map(([name, slot]) => ['slot form ' + name, slot + MERGE] as const)
  ];

  describe.each(['bash', 'zsh'])('%s', (shell) => {
    const bin = Bun.which(shell);
    // zsh -f reads only its build's global zshenv; bash -c reads no startup
    // file. A shell that hangs fails the test on its timeout.
    const runsStart = (command: string, slotExit: number) => {
      const run = Bun.spawnSync(
        [
          bin ?? shell,
          ...(shell === 'zsh' ? ['-f'] : []),
          '-c',
          command.replaceAll('/tmp/', sandbox + '/').replaceAll('cd /w', 'cd ' + sandbox)
        ],
        {
          cwd: sandbox,
          env: {
            HOME: sandbox,
            PATH: path.join(sandbox, 'bin') + ':' + process.env.PATH,
            SLOT_EXIT: String(slotExit),
            TMPPREFIX: path.join(sandbox, 'zsh')
          },
          stdin: 'ignore',
          stderr: 'ignore'
        }
      );
      return run.stdout.toString().includes('STARTED');
    };

    describe.skipIf(bin === null)('behind a slot script', () => {
      it('gates the merge with && and runs it after ;', () => {
        expect(runsStart('scripts/wait-e2e-slot.sh && ' + MERGE, 3)).toBe(false);
        expect(runsStart('scripts/wait-e2e-slot.sh; ' + MERGE, 3)).toBe(true);
        expect(runsStart('scripts/wait-e2e-slot.sh && ' + MERGE, 0)).toBe(true);
      });

      it.each(GROUP_CASES)(
        'that exits 3 runs the start only in the shells its group names ($group): $name',
        ({ command, shells }) => expect(runsStart(command, 3)).toBe(shells.includes(shell))
      );

      it.each(PASSING)('that exits 3 keeps the start gated: %s', (_, command) =>
        expect(runsStart(command, 3)).toBe(false)
      );

      it.each(PASSING)('that exits 0 lets the start run: %s', (_, command) =>
        expect(runsStart(command, 0)).toBe(true)
      );
    });
  });
});
