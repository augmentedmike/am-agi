import { z } from 'zod';

export const patchSchema = z.object({
  title: z.string().min(1).optional(),
  priority: z.enum(['critical', 'high', 'normal', 'low']).optional(),
  state: z.enum(['backlog', 'in-progress', 'in-review', 'shipped']).optional(),
  workLogEntry: z.object({ timestamp: z.string(), message: z.string() }).optional(),
  attachment: z.object({ path: z.string(), name: z.string() }).optional(),
  attachments: z.array(z.string()).optional(),
  replaceAttachments: z.array(z.object({ path: z.string(), name: z.string() })).optional(),
  removeAttachment: z.string().optional(),
  workDir: z.string().optional(),
  version: z.string().optional(),
  projectId: z.string().optional(),
  tokenLogEntry: z.object({
    iter: z.number().int(),
    inputTokens: z.number().int(),
    outputTokens: z.number().int(),
    cacheRead: z.number().int(),
    timestamp: z.string(),
  }).optional(),
  deps: z.array(z.string()).optional(),
  cardType: z.enum(['task', 'lead', 'account', 'candidate', 'contact', 'ticket']).optional(),
  entityFields: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
});
