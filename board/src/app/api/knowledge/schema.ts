import { z } from 'zod';

export const storeSchema = z.object({
  content: z.string().min(1),
  embedding: z.array(z.number()),
  source: z.string().min(1),
  cardId: z.string().optional(),
});
