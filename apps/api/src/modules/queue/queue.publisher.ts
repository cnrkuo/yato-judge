import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type * as amqp from 'amqplib';

import { QueueClient } from './queue.client.js';
import { SubmissionCreatedEvent } from './queue.events.js';

@Injectable()
export class QueuePublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueuePublisher.name);
  private channel?: amqp.ConfirmChannel;

  constructor(private readonly queueClient: QueueClient) {}

  async onModuleInit(): Promise<void> {
    this.channel = await this.queueClient.createConfirmChannel();
    if (!this.channel) {
      this.logger.error('Queue channel is not initialized');
    }

    await this.channel.assertExchange('judge.events', 'topic' as const, { durable: true });
    await this.channel.assertQueue('judge.submission.created', { durable: true });
    await this.channel.bindQueue('judge.submission.created', 'judge.events', 'submission.created');
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
  }

  async publishSubmissionCreated(payload: SubmissionCreatedEvent): Promise<void> {
    if (!this.channel) {
      throw new Error('Queue channel is not initialized');
    }

    const body = Buffer.from(JSON.stringify(payload));
    this.channel.publish('judge.events', 'submission.result', body, {
      persistent: true,
      contentType: 'application/json',
    });

    await this.channel.waitForConfirms();
  }
}
