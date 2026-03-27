import { z } from 'zod';

export const listSchema = z.object({
  state: z.enum(['backlog', 'in-progress', 'in-review', 'shipped']).optional(),
  priority: z.enum(['critical', 'high', 'normal', 'low']).optional(),
  projectId: z.string().optional(), // omit = all, empty string = null (AM Board)
  all: z.union([z.boolean(), z.string().transform(v => v === 'true')]).optional(),
});

export const createSchema = z.object({
  title: z.string().min(1),
  priority: z.enum(['AI', 'critical', 'high', 'normal', 'low']).optional(),
  workDir: z.string().optional(),
  projectId: z.string().nullable().default(null),
  parentId: z.string().nullable().optional(),
  version: z.string().optional(),
});
