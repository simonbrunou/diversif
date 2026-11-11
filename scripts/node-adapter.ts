import adapter from '@sveltejs/adapter-node';
import type { Adapter, Builder } from '@sveltejs/kit';

/**
 * adapter-node, with the client source maps left out of its asset table.
 *
 * With SENTRY_AUTH_TOKEN set, the build writes hidden source maps, and a
 * Sentry hook deletes every `.map` file once it has uploaded them. That hook
 * (`sentryUploadAfterAdapter()` in vite.config.ts, or the one in
 * `@sentry/sveltekit`) runs in a post `buildApp` hook, after the adapter.
 * adapter-node records each file that `writeClient()` returns, with its size
 * and etag, in the asset table it writes into build/adapter-node.js, and its
 * static middleware answers every path in that table without looking at the
 * disk again. So each deleted map's URL answered 200 with an empty body
 * (#722).
 *
 * The builder handed to adapter-node here still copies the maps into
 * build/client, where the upload finds each one next to its chunk, but its
 * `writeClient()` leaves them out of the list it returns. The table then holds
 * no `.map` path, whichever hook deletes the files, and a map URL falls through
 * to SvelteKit's 404, as in a build that wrote no maps. A `.map` file under
 * static/ is not served either.
 */
export function nodeAdapter(options: Parameters<typeof adapter>[0]): Adapter {
  const inner = adapter(options);
  return {
    ...inner,
    adapt(builder) {
      // Every other member, getters such as mimeTypes and the methods that
      // call this.getServerDirectory(), still resolves on the real builder.
      const withoutMaps: Builder = Object.create(builder);
      withoutMaps.writeClient = (dest) =>
        builder.writeClient(dest).filter((file) => !file.endsWith('.map'));
      return inner.adapt(withoutMaps);
    }
  };
}
