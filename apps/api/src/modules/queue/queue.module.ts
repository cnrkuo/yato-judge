import { Module } from '@nestjs/common';

import { QueueClient } from './queue.client.js';
import { QueuePublisher } from './queue.publisher.js';

@Module({
  providers: [QueueClient, QueuePublisher],
  exports: [QueueClient, QueuePublisher],
})
export class QueueModule {}
