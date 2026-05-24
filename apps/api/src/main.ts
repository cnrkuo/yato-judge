import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';

import { AppModule } from './app.module.js';

const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ logger: true }), {
  bufferLogs: true,
  bodyParser: false,
});

app.useLogger(app.get(Logger));
app.flushLogs();
app.useGlobalInterceptors(new LoggerErrorInterceptor());
app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

await app.listen(4000, '0.0.0.0');
