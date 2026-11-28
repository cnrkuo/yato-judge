import { Global, Module } from '@nestjs/common';
import { JudgeQueue } from './judge-queue.js';
import { MessageBroker } from './message-broker.js';

@Global()
@Module({ providers: [MessageBroker, JudgeQueue], exports: [MessageBroker, JudgeQueue] })
export class MessagingModule {}
