import { Global, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { Pool } from 'pg';

import { ConnectionProvider, injectConnectionToken } from '@/providers/connection.provider.js';
import { DatabaseProvider } from '@/providers/database.provider.js';

@Global()
@Module({
  providers: [ConnectionProvider, DatabaseProvider],
  exports: [DatabaseProvider],
})
export class DatabaseModule implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(private readonly moduleRef: ModuleRef) {}

  async onApplicationShutdown() {
    const conn = this.moduleRef.get<Pool>(injectConnectionToken());
    this.logger.log('Closing database connection...');

    await conn.end();
  }
}
