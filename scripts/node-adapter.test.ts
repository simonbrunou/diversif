// scripts/node-adapter.ts (#722) through the real adapter-node: its adapt()
// runs on a fake builder that copies a chunk, an entry and the service worker,
// each with its source map. The test then deletes every map, as the Sentry
// hook does after the adapter, and serves the asset table adapt() wrote with
// adapter-node's own static middleware. A request that misses the table gets
// the stand-in 404 below, where the app would hand it to SvelteKit. With the
// bare adapter, each deleted map's URL answers 200 from the table.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import adapter from '@sveltejs/adapter-node';
import type { Builder } from '@sveltejs/kit';
import { nodeAdapter } from './node-adapter.ts';

type Next = () => void;
type Middleware = (req: http.IncomingMessage, res: http.ServerResponse, next: Next) => void;

const root = mkdtempSync(path.join(tmpdir(), 'node-adapter-'));
const clientSource = path.join(root, 'output/client');
const serverSource = path.join(root, 'output/server');
const out = path.join(root, 'build');

const chunk = '_app/immutable/chunks/a1b2c3.js';
const entry = '_app/immutable/entry/start.d4e5f6.js';
const chunkCode = 'export const answer = 42;\n';
const clientFiles = {
  [chunk]: chunkCode,
  [`${chunk}.map`]: '{"version":3,"sources":["a.ts"],"mappings":""}',
  [entry]: 'export const start = true;\n',
  [`${entry}.map`]: '{"version":3,"sources":["start.ts"],"mappings":""}',
  'service-worker.js': 'self.addEventListener("install", () => {});\n',
  'service-worker.js.map': '{"version":3,"sources":["sw.ts"],"mappings":""}'
};
for (const [file, content] of Object.entries(clientFiles)) {
  mkdirSync(path.dirname(path.join(clientSource, file)), { recursive: true });
  writeFileSync(path.join(clientSource, file), content);
}
mkdirSync(serverSource, { recursive: true });

// What adapter-node's adapt() reads from SvelteKit's builder, and no more.
// writeClient copies and lists the files as SvelteKit's copy() does: paths
// relative to `dest`, with forward slashes.
const builder = {
  config: { paths: { base: '', origin: undefined } },
  log: { minor() {} },
  prerendered: { paths: [] },
  mimeTypes: { '.js': 'text/javascript', '.map': 'application/json' },
  writeClient(dest: string) {
    cpSync(clientSource, dest, { recursive: true });
    return readdirSync(clientSource, { recursive: true, withFileTypes: true })
      .filter((dirent) => dirent.isFile())
      .map((dirent) =>
        path.relative(clientSource, path.join(dirent.parentPath, dirent.name)).replaceAll('\\', '/')
      );
  },
  writePrerendered: () => [],
  compress: async () => [],
  getServerDirectory: () => serverSource,
  generateServerInstance(dest: string) {
    writeFileSync(dest, 'export const server = {};\n');
  },
  hasServerInstrumentationFile: () => false,
  getAppPath: () => '_app',
  copy(from: string, to: string) {
    cpSync(from, to, { recursive: true });
  }
} as unknown as Builder;

let server: http.Server;
let port = 0;
let mapsOnDiskAfterAdapt: boolean[] = [];

beforeAll(async () => {
  await nodeAdapter({ out }).adapt(builder);
  const maps = Object.keys(clientFiles).filter((file) => file.endsWith('.map'));
  mapsOnDiskAfterAdapt = maps.map((file) => existsSync(path.join(out, 'client', file)));
  // The Sentry hook's delete, after the adapter (filesToDeleteAfterUpload).
  for (const file of maps) rmSync(path.join(out, 'client', file));

  const adapterDir = path.dirname(
    fileURLToPath(import.meta.resolve('@sveltejs/adapter-node/package.json'))
  );
  const { create_file_map, serve_static } = (await import(
    pathToFileURL(path.join(adapterDir, 'src/static.js')).href
  )) as {
    create_file_map: (options: object) => unknown;
    serve_static: (files: unknown) => Middleware;
  };
  const generated = await import(pathToFileURL(path.join(out, 'adapter-node.js')).href);
  const serve = serve_static(create_file_map(generated));

  server = http.createServer((req, res) =>
    serve(req, res, () => {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    })
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as { port: number }).port;
});

afterAll(() => {
  server?.close();
  rmSync(root, { recursive: true, force: true });
});

function request(method: 'GET' | 'HEAD', pathname: string) {
  return new Promise<{ status: number; type: string | undefined; body: string }>(
    (resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, method, path: pathname }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (part: string) => (body += part));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, type: res.headers['content-type'], body })
        );
        res.on('error', reject);
      });
      req.on('error', reject);
      req.end();
    }
  );
}

describe('nodeAdapter', () => {
  it('copies every source map into the output, where the Sentry upload reads it', () => {
    expect(mapsOnDiskAfterAdapt).toEqual([true, true, true]);
  });

  for (const map of [`/${chunk}.map`, `/${entry}.map`, '/service-worker.js.map']) {
    it(`leaves the deleted ${map} out of the asset table, for HEAD and GET`, async () => {
      // HEAD first: the bare adapter answers it 200 with the recorded size,
      // while its GET can end in a dropped stream.
      expect(await request('HEAD', map)).toEqual({ status: 404, type: 'text/plain', body: '' });
      expect(await request('GET', map)).toEqual({
        status: 404,
        type: 'text/plain',
        body: 'Not found'
      });
    });
  }

  it('still serves the chunk itself from the asset table', async () => {
    expect(await request('GET', `/${chunk}`)).toEqual({
      status: 200,
      type: 'text/javascript',
      body: chunkCode
    });
  });

  it('keeps the rest of adapter-node, its Vite plugin included', () => {
    const bare = adapter({ out });
    const wrapped = nodeAdapter({ out });
    expect(Object.keys(wrapped).sort()).toEqual(Object.keys(bare).sort());
    expect(wrapped.name).toBe(bare.name);
  });
});
