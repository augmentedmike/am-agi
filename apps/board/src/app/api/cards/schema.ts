import { z } from 'zod';

export const listSchema = z.object({
  state: z.enum(['backlog', 'in-progress', 'in-review', 'shipped']).optional(),
  priority: z.enum(['critical', 'high', 'normal', 'low']).optional(),
});

export const createSchema = z.object({
  title: z.string().min(1),
  priority: z.enum(['AI', 'critical', 'high', 'normal', 'low']).optional(),
  workDir: z.string().optional(),
});
