import { randomUUID } from "crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

export type KanbanState = "backlog" | "in-progress" | "in-review" | "shipped";

export type KanbanPriority = "critical" | "high" | "normal" | "low";

export interface KanbanCard {
  id: string;
  title: string;
  state: KanbanState;
  priority: KanbanPriority;
  createdAt: Date;
  updatedAt: Date;
}

export interface SteeringRequest {
  id: string;
  cardId: string;
  from: KanbanState;
  to: KanbanState;
  reason?: string;
  requestedAt: Date;
}

export interface DecisionLog {
  id: string;
  cardId: string;
  action: "created" | "moved" | "steering-requested";
  from?: KanbanState;
  to?: KanbanState;
  reason?: string;
  timestamp: Date;
}

// ── State machine ─────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<KanbanState, KanbanState | null> = {
  backlog: "in-progress",
  "in-progress": "in-review",
  "in-review": "shipped",
  shipped: null,
};

function isValidTransition(from: KanbanState, to: KanbanState): boolean {
  return VALID_TRANSITIONS[from] === to;
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export class KanbanPlugin {
  private cards: Map<string, KanbanCard> = new Map();
  private steeringRequests: Map<string, SteeringRequest> = new Map();
  private decisionLogs: DecisionLog[] = [];

  createCard(title: string, priority: KanbanPriority = "normal"): KanbanCard {
    const id = randomUUID();
    const now = new Date();
    const card: KanbanCard = {
      id,
      title,
      state: "backlog",
      priority,
      createdAt: now,
      updatedAt: now,
    };
    this.cards.set(id, card);
    this.decisionLogs.push({
      id: randomUUID(),
      cardId: id,
      action: "created",
      to: "backlog",
      timestamp: now,
    });
    return card;
  }

  moveCard(cardId: string, to: KanbanState): KanbanCard {
    const card = this.cards.get(cardId);
    if (!card) throw new Error(`Card not found: ${cardId}`);
    if (!isValidTransition(card.state, to)) {
      throw new Error(
        `Invalid transition: ${card.state} → ${to}. Valid next state is ${VALID_TRANSITIONS[card.state] ?? "none (shipped is terminal)"}.`
      );
    }
    const from = card.state;
    card.state = to;
    card.updatedAt = new Date();
    this.decisionLogs.push({
      id: randomUUID(),
      cardId,
      action: "moved",
      from,
      to,
      timestamp: card.updatedAt,
    });
    return card;
  }

  requestSteering(
    cardId: string,
    from: KanbanState,
    to: KanbanState,
    reason?: string
  ): SteeringRequest {
    const card = this.cards.get(cardId);
    if (!card) throw new Error(`Card not found: ${cardId}`);
    const id = randomUUID();
    const now = new Date();
    const req: SteeringRequest = { id, cardId, from, to, reason, requestedAt: now };
    this.steeringRequests.set(id, req);
    this.decisionLogs.push({
      id: randomUUID(),
      cardId,
      action: "steering-requested",
      from,
      to,
      reason,
      timestamp: now,
    });
    return req;
  }

  getDecisionLogs(cardId?: string): DecisionLog[] {
    if (cardId === undefined) return [...this.decisionLogs];
    return this.decisionLogs.filter((l) => l.cardId === cardId);
  }

  getCard(cardId: string): KanbanCard | undefined {
    return this.cards.get(cardId);
  }

  listCards(): KanbanCard[] {
    return [...this.cards.values()];
  }
}
