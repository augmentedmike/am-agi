import { z } from 'zod';

export const patchSchema = z.object({
  title: z.string().min(1).optional(),
  priority: z.enum(['critical', 'high', 'normal', 'low']).optional(),
  workLogEntry: z.object({ timestamp: z.string(), message: z.string() }).optional(),
  attachment: z.object({ path: z.string(), name: z.string() }).optional(),
  attachments: z.array(z.string()).optional(),
  removeAttachment: z.string().optional(),
  workDir: z.string().optional(),
});
