import { Controller } from '@nestjs/common';
import { Implement, implement, ORPCError } from '@orpc/nest';
import { submissions } from '@yato/shared/contracts';

import { SubmissionsService } from './submissions.service.js';

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly service: SubmissionsService) {}

  @Implement(submissions.create)
  create() {
    return implement(submissions.create).handler(async ({ input }) => await this.service.createSubmission(input));
  }

  @Implement(submissions.getById)
  getById() {
    return implement(submissions.getById).handler(async ({ input }) => {
      const submission = await this.service.getById(input.id);
      if (!submission) {
        throw new ORPCError('NOT_FOUND', {
          message: `Submission not found: ${input.id}`,
        });
      }

      return submission;
    });
  }
}
