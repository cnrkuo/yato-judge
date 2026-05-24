import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { REQUEST } from '@nestjs/core';
import { ORPCError, ORPCModule, onError } from '@orpc/nest';
import { experimental_RethrowHandlerPlugin } from '@orpc/server/plugins';
import type { FastifyRequest } from 'fastify';
import { LoggerModule } from 'nestjs-pino';
import * as v from 'valibot';

import { DatabaseModule } from '$/database/database.module.js';
import { SubmissionsModule } from '$/submissions/submissions.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) =>
        v.safeParse(
          v.object({
            NODE_ENV: v.picklist(['development', 'production', 'test']),
            DATABASE_URL: v.pipe(v.string(), v.url()),
            RABBITMQ_URL: v.pipe(v.string(), v.url()),
          }),
          config,
        ),
    }),
    ORPCModule.forRootAsync({
      useFactory: (request: FastifyRequest) => ({
        interceptors: [
          onError((err) => {
            request.log.error({ err }, 'oRPC error');
          }),
        ],
        context: { request },
        plugins: [
          new experimental_RethrowHandlerPlugin({
            filter: (err) => !(err instanceof ORPCError),
          }),
        ],
      }),
      inject: [REQUEST],
    }),
    LoggerModule.forRoot({
      exclude: [],
      useExisting: true,
    }),
    DatabaseModule,
    SubmissionsModule,
  ],
})
export class AppModule {}
