import { z } from 'zod';

export const listSchema = z.object({
  state: z.enum(['backlog', 'in-progress', 'in-review', 'shipped']).optional(),
  priority: z.enum(['critical', 'high', 'normal', 'low']).optional(),
  projectId: z.string().optional(), // omit = all, empty string = null (AM Board)
  all: z.union([z.boolean(), z.string().transform(v => v === 'true')]).optional(),
  cardType: z.enum(['task', 'lead', 'account', 'candidate']).optional(),
});

export const createSchema = z.object({
  title: z.string().min(1),
  priority: z.enum(['AI', 'critical', 'high', 'normal', 'low']).optional(),
  workDir: z.string().optional(),
  projectId: z.string().nullable().default(null),
  parentId: z.string().nullable().optional(),
  version: z.string().optional(),
  cardType: z.enum(['task', 'lead', 'account', 'candidate']).optional().default('task'),
  entityFields: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional().default({}),
});
