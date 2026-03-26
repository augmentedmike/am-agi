const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface VelocityCard {
  state: string;
  shippedAt?: string | null;
}

/**
 * Counts cards shipped within the last `windowDays` days from `now`.
 * A card counts if:
 *   - state === 'shipped'
 *   - shippedAt is a valid ISO string
 *   - shippedAt >= (now - windowDays * MS_PER_DAY)  [boundary inclusive]
 *   - shippedAt <= now
 */
export function countShippedInWindow(
  cards: VelocityCard[],
  windowDays: number,
  now: Date = new Date(),
): number {
  const nowMs = now.getTime();
  const windowStartMs = nowMs - windowDays * MS_PER_DAY;

  return cards.filter(card => {
    if (card.state !== 'shipped') return false;
    if (!card.shippedAt) return false;
    const shippedMs = new Date(card.shippedAt).getTime();
    return shippedMs >= windowStartMs && shippedMs <= nowMs;
  }).length;
}

/**
 * Returns the average number of cards shipped per day over `windowDays`.
 * Computed as countShippedInWindow / windowDays.
 */
export function velocityPerDay(
  cards: VelocityCard[],
  windowDays: number,
  now: Date = new Date(),
): number {
  if (windowDays <= 0) return 0;
  return countShippedInWindow(cards, windowDays, now) / windowDays;
}
