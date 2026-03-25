import { z } from 'zod';

export const searchSchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  embedding: z.string().optional(),
});
