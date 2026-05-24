import { Module } from '@nestjs/common';

import { QueueModule } from '$/queue/queue.module.js';
import { SubmissionsResultConsumer } from './submissions.consumer.js';
import { SubmissionsController } from './submissions.controller.js';
import { SubmissionsRepository } from './submissions.repository.js';
import { SubmissionsService } from './submissions.service.js';

@Module({
  imports: [QueueModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsRepository, SubmissionsService, SubmissionsResultConsumer],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
