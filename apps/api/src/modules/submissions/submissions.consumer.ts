import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type * as amqp from 'amqplib';
import * as v from 'valibot';

import { QueueClient } from '$/queue/queue.client.js';
import { judgeResultEventSchema } from '$/queue/queue.events.js';
import { SubmissionsService } from './submissions.service.js';

@Injectable()
export class SubmissionsResultConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SubmissionsResultConsumer.name);
  private channel?: amqp.Channel;

  constructor(
    private readonly queueClient: QueueClient,
    private readonly submissionsService: SubmissionsService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.channel = await this.queueClient.createChannel();
    if (!this.channel) {
      this.logger.error('Queue channel is not initialized');
    }

    await this.channel.assertExchange('judge.events', 'topic', { durable: true });
    await this.channel.assertQueue('judge.submission.result', { durable: true });
    await this.channel.bindQueue('judge.submission.result', 'judge.events', 'submission.result');
    await this.channel.prefetch(1);
    await this.channel.consume('judge.submission.result', (msg) => {
      void this.handleMessage(msg);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
  }

  private async handleMessage(msg: amqp.ConsumeMessage | null): Promise<void> {
    if (!msg || !this.channel) return;

    try {
      const payload = JSON.parse(msg.content.toString());
      const parsed = v.safeParse(judgeResultEventSchema, payload);
      if (!parsed.success) {
        this.channel.nack(msg, false, false);

        // FIXME: dont quietly fail
        return;
      }

      await this.submissionsService.applyJudgeResult(parsed.output);
      this.channel.ack(msg);
    } catch (error) {
      this.logger.error(error);
      this.channel.nack(msg, false, true);
    }
  }
}
