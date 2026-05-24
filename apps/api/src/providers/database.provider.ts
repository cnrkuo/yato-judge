import { Inject, type Provider } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';

import * as schema from '@/db/schema.js';
import { injectConnectionToken } from './connection.provider.js';

export const DATABASE_PROVIDER_TOKEN = Symbol('DATABASE_PROVIDER_TOKEN');

export const DatabaseProvider: Provider = {
  provide: DATABASE_PROVIDER_TOKEN,
  inject: [injectConnectionToken()],
  useFactory: (pool: Pool) => drizzle(pool, { schema }),
};

export const InjectDatabase = () => Inject(DATABASE_PROVIDER_TOKEN);
export const injectDatabaseToken = () => DATABASE_PROVIDER_TOKEN;

export type DatabaseContext = NodePgDatabase<typeof schema>;
