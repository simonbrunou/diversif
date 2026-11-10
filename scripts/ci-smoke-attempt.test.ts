// #697: ci.yml's `docker-build` job named its smoke image, container and
// volume by the run id alone. A re-run keeps the run id, so when the runner
// lost an attempt before its cleanup step, the re-run's `docker run --name`
// collided with the container that attempt left on the runner CT's Docker
// daemon, or mounted its volume. The job now names all three per run and
// attempt, and a step before the build removes what earlier attempts of the
// run left. The first tests read the job's names and steps from the workflow.
// The rest run that step's own `run:` text under bash, as `shell: bash` runs
// it, with a stub `docker` first on PATH. The stub keeps its containers,
// volumes and images as files, fails the one call DOCKER_STUB_FAIL names, and
// answers as Docker 29.9.3 did on the dev host (#697): the `name` filter is an
// unanchored regex, matched against a container's name with and without its
// leading slash; `volume rm` refuses a volume that a container still mounts,
// even with --force; `rm --force`, `volume rm --force` and `image rm --force`
// exit 0 on a missing name, `image rm` printing an error for it.
import { afterAll, describe, expect, it } from 'bun:test';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse } from 'yaml';

const repo = path.resolve(import.meta.dir, '..');
const CI = '.forgejo/workflows/ci.yml';
const REMOVAL = "Remove earlier attempts' container, volume and image";
const START = 'Start the built image against a throwaway data volume';
const RUN_ID = '4011';
const IMAGE_ID = '0123456789ab';
const NAMES = ['SMOKE_IMAGE', 'SMOKE_CONTAINER', 'SMOKE_VOLUME'] as const;
// forgejo-runner v13 runs a `shell: bash` step file as
// `bash --noprofile --norc -e -o pipefail <file>` (act/runner/step_run.go).
const BASH_FLAGS = ['--noprofile', '--norc', '-e', '-o', 'pipefail'];
// A few bash runs per test; a loaded CI runner stalls a process for seconds
// (#572), so the tests get 30 s instead of the 5 s default.
const TIMEOUT = 30_000;
// See check-bun-pins.test.ts: a loaded runner can take seconds to remove a tree.
const CLEANUP_TIMEOUT = 60_000;

type Step = {
  name?: string;
  uses?: string;
  run?: string;
  shell?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
};
type Job = { env: Record<string, string>; steps: Step[] };

function dockerBuildJob(): Job {
  const workflow = parse(readFileSync(path.join(repo, CI), 'utf8')) as {
    jobs: Record<string, Job>;
  };
  return workflow.jobs['docker-build']!;
}

function step(name: string): Step {
  const found = dockerBuildJob().steps.filter((s) => s.name === name);
  if (found.length !== 1)
    throw new Error(`${CI} has ${found.length} docker-build steps named ${name}`);
  return found[0]!;
}

const label = (s: Step): string => s.name ?? s.uses ?? s.run ?? '?';

// A name of attempt `attempt`, from the job's own env value.
function nameOf(env: (typeof NAMES)[number], attempt: string): string {
  return dockerBuildJob()
    .env[env]!.replaceAll('${{ github.run_id }}', RUN_ID)
    .replaceAll('${{ github.run_attempt }}', attempt);
}
const container = (n: number | string) => nameOf('SMOKE_CONTAINER', String(n));
const volume = (n: number | string) => nameOf('SMOKE_VOLUME', String(n));
const image = (n: number | string) => nameOf('SMOKE_IMAGE', String(n));

describe('the docker-build job', () => {
  it('names its image, container and volume once, per run and attempt', () => {
    const job = dockerBuildJob();
    expect(job.env.SMOKE_IMAGE).toBe(
      'diversif:ci-smoke-${{ github.run_id }}-${{ github.run_attempt }}'
    );
    expect(job.env.SMOKE_CONTAINER).toBe(
      'diversif-smoke-${{ github.run_id }}-${{ github.run_attempt }}'
    );
    expect(job.env.SMOKE_VOLUME).toBe(
      'diversif-smoke-data-${{ github.run_id }}-${{ github.run_attempt }}'
    );
    const resets = job.steps.flatMap((s) =>
      Object.keys(s.env ?? {})
        .filter((name) => (NAMES as readonly string[]).includes(name))
        .map((name) => `${label(s)} sets ${name}`)
    );
    expect(resets).toEqual([]);
  });

  it('spells out no smoke name in a step instead of reading the env', () => {
    const spelled = dockerBuildJob().steps.flatMap((s) =>
      [s.run, ...Object.values(s.with ?? {}), ...Object.values(s.env ?? {})]
        .filter((text): text is string => typeof text === 'string')
        .filter((text) => /diversif[-:](ci-)?smoke/.test(text))
        .map((text) => `${label(s)}: ${text}`)
    );
    expect(spelled).toEqual([]);
  });

  it('runs the removal step under bash, before any docker build, on github.run_attempt', () => {
    const steps = dockerBuildJob().steps;
    const removal = steps.findIndex((s) => s.name === REMOVAL);
    const build = steps.findIndex((s) => (s.run ?? '').includes('docker build'));
    expect(removal).toBeGreaterThanOrEqual(0);
    expect(build).toBeGreaterThan(removal);
    expect(steps[removal]!.shell).toBe('bash');
    expect(steps[removal]!.env).toEqual({ RUN_ATTEMPT: '${{ github.run_attempt }}' });
  });

  it('prints the three names before the start step runs docker run', () => {
    const lines = step(START).run!.split('\n');
    const echo = lines.findIndex(
      (l) =>
        l.startsWith('echo ') &&
        l.includes('$SMOKE_CONTAINER') &&
        l.includes('$SMOKE_IMAGE') &&
        l.includes('$SMOKE_VOLUME')
    );
    const dockerRun = lines.findIndex((l) => l.startsWith('docker run '));
    expect(echo).toBeGreaterThanOrEqual(0);
    expect(dockerRun).toBeGreaterThan(echo);
  });
});

const STUB = String.raw`
# Answers the six docker calls the removal step makes, and fails on any other.
state=$DOCKER_STUB_STATE
printf '%s\n' "$*" >>"$state/calls"
call=$1
case "$1" in volume | image) call="$1 $2" ;; esac
if [ "$call" = "${'${DOCKER_STUB_FAIL:-}'}" ]; then
  echo "Error response from daemon: stub failure on $call" >&2
  exit 1
fi
case "$1 $2 $3 $4" in
  "ps --all --quiet --filter")
    regex=${'${5#name=}'}
    for f in "$state"/containers/*; do
      [ -e "$f" ] || continue
      name=${'${f##*/}'}
      if printf '%s\n' "/$name" "$name" | grep -Eq -- "$regex"; then echo "id-$name"; fi
    done
    ;;
  "rm --force "*)
    rm -f -- "$state/containers/$3"
    ;;
  "volume ls --quiet --filter")
    regex=${'${5#name=}'}
    for f in "$state"/volumes/*; do
      [ -e "$f" ] || continue
      name=${'${f##*/}'}
      if printf '%s\n' "$name" | grep -Eq -- "$regex"; then echo "$name"; fi
    done
    ;;
  "volume rm --force "*)
    for f in "$state"/containers/*; do
      [ -e "$f" ] || continue
      if [ "$(cat "$f")" = "$4" ]; then
        echo "Error response from daemon: remove $4: volume is in use - [id-${'${f##*/}'}]" >&2
        exit 1
      fi
    done
    rm -f -- "$state/volumes/$4"
    echo "$4"
    ;;
  "images --quiet "*)
    if [ -e "$state/images/$3" ]; then echo "$DOCKER_STUB_IMAGE_ID"; fi
    ;;
  "image rm --force "*)
    if [ -e "$state/images/$4" ]; then
      rm -f -- "$state/images/$4"
      echo "Untagged: $4"
    else
      echo "Error response from daemon: No such image: $4" >&2
    fi
    ;;
  *)
    echo "docker stub: unexpected call: $*" >&2
    exit 2
    ;;
esac
`;

const bash = Bun.which('bash');
if (!bash) throw new Error('bash is not on PATH');
const base = mkdtempSync(path.join(tmpdir(), 'ci-smoke-attempt-'));
let stubCount = 0;
afterAll(() => rmSync(base, { recursive: true, force: true }), CLEANUP_TIMEOUT);

type Stub = { dir: string; state: string; bin: string };

// A fresh stub. `containers` maps each container's name to the volume it
// mounts ('' for none).
function stub(
  opts: { containers?: Record<string, string>; volumes?: string[]; images?: string[] } = {}
): Stub {
  stubCount += 1;
  const dir = path.join(base, String(stubCount));
  const s = { dir, state: path.join(dir, 'state'), bin: path.join(dir, 'bin') };
  for (const sub of ['containers', 'volumes', 'images']) {
    mkdirSync(path.join(s.state, sub), { recursive: true });
  }
  mkdirSync(s.bin);
  writeFileSync(path.join(s.state, 'calls'), '');
  for (const [name, mounted] of Object.entries(opts.containers ?? {})) {
    writeFileSync(path.join(s.state, 'containers', name), mounted);
  }
  for (const name of opts.volumes ?? []) writeFileSync(path.join(s.state, 'volumes', name), '');
  for (const name of opts.images ?? []) writeFileSync(path.join(s.state, 'images', name), '');
  writeFileSync(path.join(s.bin, 'docker'), `#!${bash}\n${STUB}`);
  chmodSync(path.join(s.bin, 'docker'), 0o755);
  return s;
}

function runRemoval(
  s: Stub,
  attempt: string,
  opts: { fail?: string; names?: Partial<Record<(typeof NAMES)[number], string>> } = {}
) {
  const script = path.join(s.dir, 'removal.sh');
  writeFileSync(script, step(REMOVAL).run!);
  const env: Record<string, string> = {
    PATH: `${s.bin}:${process.env.PATH ?? ''}`,
    DOCKER_STUB_STATE: s.state,
    DOCKER_STUB_IMAGE_ID: IMAGE_ID,
    RUN_ATTEMPT: attempt,
    SMOKE_CONTAINER: container(attempt),
    SMOKE_VOLUME: volume(attempt),
    SMOKE_IMAGE: image(attempt),
    ...opts.names
  };
  if (opts.fail) env.DOCKER_STUB_FAIL = opts.fail;
  const r = Bun.spawnSync({ cmd: [bash!, ...BASH_FLAGS, script], env });
  return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() };
}

const calls = (s: Stub) =>
  readFileSync(path.join(s.state, 'calls'), 'utf8').split('\n').filter(Boolean);
const removals = (s: Stub) => calls(s).filter((c) => /^(volume |image )?rm /.test(c));
const left = (s: Stub, kind: 'containers' | 'volumes' | 'images') =>
  readdirSync(path.join(s.state, kind)).sort();

// Names that contain attempt 1's name without being it.
const decoys = (name: string) => [`${name}0`, `${name}x`, `pre-${name}`];

describe('the removal step', () => {
  it(
    'on attempt 1 prints one line, calls no docker and keeps its own names',
    () => {
      const s = stub({
        containers: { [container(1)]: volume(1) },
        volumes: [volume(1)],
        images: [image(1)]
      });
      expect(runRemoval(s, '1')).toEqual({
        code: 0,
        out: 'This is attempt 1: no earlier attempt to clean up\n',
        err: ''
      });
      expect(calls(s)).toEqual([]);
      expect(left(s, 'containers')).toEqual([container(1)]);
      expect(left(s, 'volumes')).toEqual([volume(1)]);
      expect(left(s, 'images')).toEqual([image(1)]);
    },
    TIMEOUT
  );

  it(
    'on attempt 3 removes what attempts 1 and 2 left, each container before its volume, then the image',
    () => {
      const s = stub({
        containers: {
          [container(1)]: volume(1),
          [container(2)]: volume(2),
          [container(3)]: volume(3)
        },
        volumes: [volume(1), volume(2), volume(3)],
        images: [image(1), image(2), image(3)]
      });
      expect(runRemoval(s, '3')).toEqual({
        code: 0,
        out:
          `Attempt 1: container ${container(1)} removed, volume ${volume(1)} removed, image ${image(1)} removed\n` +
          `Attempt 2: container ${container(2)} removed, volume ${volume(2)} removed, image ${image(2)} removed\n`,
        err: ''
      });
      expect(removals(s)).toEqual([
        `rm --force ${container(1)}`,
        `volume rm --force ${volume(1)}`,
        `image rm --force ${image(1)}`,
        `rm --force ${container(2)}`,
        `volume rm --force ${volume(2)}`,
        `image rm --force ${image(2)}`
      ]);
      expect(left(s, 'containers')).toEqual([container(3)]);
      expect(left(s, 'volumes')).toEqual([volume(3)]);
      expect(left(s, 'images')).toEqual([image(3)]);
    },
    TIMEOUT
  );

  it(
    'skips each name that is absent and removes the ones left',
    () => {
      const s = stub({ volumes: [volume(1)], images: [image(2)] });
      expect(runRemoval(s, '3')).toEqual({
        code: 0,
        out:
          `Attempt 1: container ${container(1)} absent, volume ${volume(1)} removed, image ${image(1)} absent\n` +
          `Attempt 2: container ${container(2)} absent, volume ${volume(2)} absent, image ${image(2)} removed\n`,
        err: ''
      });
      expect(removals(s)).toEqual([
        `volume rm --force ${volume(1)}`,
        `image rm --force ${image(2)}`
      ]);
      expect(left(s, 'volumes')).toEqual([]);
      expect(left(s, 'images')).toEqual([]);
    },
    TIMEOUT
  );

  it(
    'checks each name exactly, so a name that only contains it stays',
    () => {
      const s = stub({
        containers: Object.fromEntries(decoys(container(1)).map((c) => [c, ''])),
        volumes: decoys(volume(1)),
        images: decoys(image(1))
      });
      expect(runRemoval(s, '2')).toEqual({
        code: 0,
        out: `Attempt 1: container ${container(1)} absent, volume ${volume(1)} absent, image ${image(1)} absent\n`,
        err: ''
      });
      expect(calls(s)).toEqual([
        `ps --all --quiet --filter name=^/${container(1)}$`,
        `volume ls --quiet --filter name=^${volume(1)}$`,
        `images --quiet ${image(1)}`
      ]);
      expect(left(s, 'containers')).toEqual(decoys(container(1)).sort());
      expect(left(s, 'volumes')).toEqual(decoys(volume(1)).sort());
      expect(left(s, 'images')).toEqual(decoys(image(1)).sort());
    },
    TIMEOUT
  );

  // Attempt 1 left all three, so the step reaches all six calls.
  it.each(['ps', 'rm', 'volume ls', 'volume rm', 'images', 'image rm'])(
    'fails at a failed docker %s with an ::error:: line, before it reports the attempt',
    (call) => {
      const s = stub({
        containers: { [container(1)]: volume(1) },
        volumes: [volume(1)],
        images: [image(1)]
      });
      const r = runRemoval(s, '2', { fail: call });
      expect(r.code).toBe(1);
      expect(r.out).toBe(
        '::error::a docker call failed while removing what attempt 1 of this run left\n'
      );
      expect(r.err).toBe(`Error response from daemon: stub failure on ${call}\n`);
      expect(calls(s).at(-1)!.startsWith(`${call} `)).toBe(true);
    },
    TIMEOUT
  );

  it(
    'names the attempt it was removing when a docker call fails',
    () => {
      const s = stub({
        containers: { [container(2)]: '' },
        volumes: [volume(2)],
        images: [image(2)]
      });
      const r = runRemoval(s, '3', { fail: 'volume rm' });
      expect(r.code).toBe(1);
      expect(r.out).toBe(
        `Attempt 1: container ${container(1)} absent, volume ${volume(1)} absent, image ${image(1)} absent\n` +
          '::error::a docker call failed while removing what attempt 2 of this run left\n'
      );
      expect(r.err).toBe('Error response from daemon: stub failure on volume rm\n');
    },
    TIMEOUT
  );

  // A forge that stopped sending run_attempt would give every attempt one name.
  it.each(['', '0', '01', 'a', '2x', '-1', ' 2'])(
    'fails before any docker call on run_attempt %p',
    (attempt) => {
      const s = stub();
      const r = runRemoval(s, attempt);
      expect(r.code).toBe(1);
      expect(r.out).toBe(
        `::error::github.run_attempt is '${attempt}', not a positive integer, so the smoke container, volume and image names do not tell this run's attempts apart\n`
      );
      expect(calls(s)).toEqual([]);
    },
    TIMEOUT
  );

  it.each(NAMES)(
    'fails before any docker call when %s lacks the attempt suffix',
    (name) => {
      const s = stub();
      const r = runRemoval(s, '2', { names: { [name]: nameOf(name, '2').replace(/-2$/, '') } });
      expect(r.code).toBe(1);
      expect(r.out).toContain('::error::');
      expect(r.out).toContain('must all end in -2');
      expect(calls(s)).toEqual([]);
    },
    TIMEOUT
  );
});
