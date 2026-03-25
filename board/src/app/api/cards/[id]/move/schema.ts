import { z } from 'zod';

export const moveSchema = z.object({
  state: z.enum(['backlog', 'in-progress', 'in-review', 'shipped']),
  note: z.string().optional(),
});
