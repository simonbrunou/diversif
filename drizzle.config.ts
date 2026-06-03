import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/server/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    // drizzle-kit (push/studio) talks to a local file; the running app uses
    // DATABASE_PATH via src/lib/server/db/index.ts. Falls back to a throwaway
    // local file for `db:push`/`db:studio` during development.
    url: process.env.DATABASE_PATH ?? './local.db'
  }
} satisfies Config;
