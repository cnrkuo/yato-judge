// import 'reflect-metadata';
//
// import * as amqp from 'amqplib';
// import { eq } from 'drizzle-orm';
// import * as v from 'valibot';
//
// import { db } from '@/common/db/client.js';
// import { submissions } from '@/common/db/schema.js';
// import { env } from '@/common/env.js';
// import { queueConfig } from '$/queue/queue.config.js';
// import { submissionCreatedEventSchema } from '$/queue/queue.events.js';
//
// const handleMessage = async (channel: amqp.ConfirmChannel, message: amqp.ConsumeMessage): Promise<void> => {
//   let payload: unknown;
//   try {
//     payload = JSON.parse(message.content.toString());
//   } catch (err) {
//     console.error('Invalid submission created payload', err);
//     channel.nack(message, false, false);
//
//     return;
//   }
//
//   const parsed = v.safeParse(submissionCreatedEventSchema, payload);
//   if (!parsed.success) {
//     channel.nack(message, false, false);
//
//     return;
//   }
//
//   const [submission] = await db.select().from(submissions).where(eq(submissions.id, parsed.output.id));
//   if (!submission) {
//     console.error('Submission not found for worker', parsed.output.id);
//   }
//
//   const resultEvent = {
//     submissionId: parsed.output.id,
//     verdict: 'SYSTEM_ERROR',
//     meta: {
//       reason: 'worker_stub',
//     },
//   };
//
//   channel.publish(
//     queueConfig.exchange,
//     queueConfig.queues.submissionResult.routingKey,
//     Buffer.from(JSON.stringify(resultEvent)),
//     {
//       persistent: true,
//       contentType: 'application/json',
//     },
//   );
//   await channel.waitForConfirms();
//   channel.ack(message);
// };
//
// const startWorker = async (): Promise<void> => {
//   const connection = await amqp.connect(env.rabbitmqUrl);
//   const channel = await connection.createConfirmChannel();
//   await channel.assertExchange(queueConfig.exchange, queueConfig.exchangeType, {
//     durable: true,
//   });
//   await channel.assertQueue(queueConfig.queues.submissionCreated.queue, {
//     durable: true,
//   });
//   await channel.bindQueue(
//     queueConfig.queues.submissionCreated.queue,
//     queueConfig.exchange,
//     queueConfig.queues.submissionCreated.routingKey,
//   );
//   await channel.prefetch(1);
//   await channel.consume(queueConfig.queues.submissionCreated.queue, (message) => {
//     if (!message) {
//       return;
//     }
//     void handleMessage(channel, message).catch((error) => {
//       console.error('Failed to process submission created message', error);
//       channel.nack(message, false, true);
//     });
//   });
// };
//
// startWorker().catch((error) => {
//   console.error(error);
//   process.exit(1);
// });
