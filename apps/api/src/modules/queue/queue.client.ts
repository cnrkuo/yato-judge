import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;

@Injectable()
export class QueueClient implements OnModuleInit, OnModuleDestroy {
  private connection?: AmqpConnection;
  constructor(private configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureConnection();
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection?.close();
  }

  async createChannel(): Promise<amqp.Channel> {
    const conn = await this.ensureConnection();
    return conn.createChannel();
  }

  async createConfirmChannel(): Promise<amqp.ConfirmChannel> {
    const conn = await this.ensureConnection();
    return conn.createConfirmChannel();
  }

  private async ensureConnection(): Promise<AmqpConnection> {
    if (!this.connection) {
      this.connection = await amqp.connect(this.configService.get('RABBITMQ_URL')!);
    }

    return this.connection;
  }
}
