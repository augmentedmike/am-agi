import { randomUUID } from "crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  scheduledAt: Date;
  recurrenceRule?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SteeringProposal {
  id: string;
  eventId: string;
  scheduledAt: Date;
  status: "pending" | "approved" | "rejected" | "edited";
  reason?: string;
  interpretability?: SteeringInterpretability;
  createdAt: Date;
  updatedAt: Date;
}

export interface SteeringInterpretability {
  rationale: string;
  confidence?: number;
  alternatives?: Array<{ scheduledAt: Date; rationale: string }>;
}

export interface SteeringFeedback {
  id: string;
  proposalId?: string;
  eventId?: string;
  feedback: string;
  rating?: number;
  recordedAt: Date;
}

export interface DecisionLog {
  id: string;
  eventId: string;
  proposalId?: string;
  action: "created" | "proposed" | "approved" | "rejected" | "edited" | "feedback";
  scheduledAt?: Date;
  reason?: string;
  timestamp: Date;
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export class CalendarPlugin {
  private events: Map<string, CalendarEvent> = new Map();
  private proposals: Map<string, SteeringProposal> = new Map();
  private feedbacks: SteeringFeedback[] = [];
  private decisionLogs: DecisionLog[] = [];

  createEvent(
    title: string,
    scheduledAt: Date,
    recurrenceRule?: string
  ): CalendarEvent {
    const id = randomUUID();
    const now = new Date();
    const event: CalendarEvent = {
      id,
      title,
      scheduledAt,
      recurrenceRule,
      createdAt: now,
      updatedAt: now,
    };
    this.events.set(id, event);
    this.decisionLogs.push({
      id: randomUUID(),
      eventId: id,
      action: "created",
      scheduledAt,
      timestamp: now,
    });
    return event;
  }

  proposeSchedule(
    eventId: string,
    scheduledAt: Date,
    interpretability?: SteeringInterpretability
  ): SteeringProposal {
    const event = this.events.get(eventId);
    if (!event) throw new Error(`Event not found: ${eventId}`);
    const id = randomUUID();
    const now = new Date();
    const proposal: SteeringProposal = {
      id,
      eventId,
      scheduledAt,
      status: "pending",
      interpretability,
      createdAt: now,
      updatedAt: now,
    };
    this.proposals.set(id, proposal);
    this.decisionLogs.push({
      id: randomUUID(),
      eventId,
      proposalId: id,
      action: "proposed",
      scheduledAt,
      timestamp: now,
    });
    return proposal;
  }

  approveProposal(proposalId: string): CalendarEvent {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);
    const event = this.events.get(proposal.eventId);
    if (!event) throw new Error(`Event not found: ${proposal.eventId}`);
    const now = new Date();
    proposal.status = "approved";
    proposal.updatedAt = now;
    event.scheduledAt = proposal.scheduledAt;
    event.updatedAt = now;
    this.decisionLogs.push({
      id: randomUUID(),
      eventId: event.id,
      proposalId,
      action: "approved",
      scheduledAt: proposal.scheduledAt,
      timestamp: now,
    });
    return event;
  }

  rejectProposal(proposalId: string, reason?: string): SteeringProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);
    const now = new Date();
    proposal.status = "rejected";
    proposal.reason = reason;
    proposal.updatedAt = now;
    this.decisionLogs.push({
      id: randomUUID(),
      eventId: proposal.eventId,
      proposalId,
      action: "rejected",
      reason,
      timestamp: now,
    });
    return proposal;
  }

  editProposal(proposalId: string, scheduledAt: Date): SteeringProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);
    const now = new Date();
    proposal.scheduledAt = scheduledAt;
    proposal.status = "edited";
    proposal.updatedAt = now;
    this.decisionLogs.push({
      id: randomUUID(),
      eventId: proposal.eventId,
      proposalId,
      action: "edited",
      scheduledAt,
      timestamp: now,
    });
    return proposal;
  }

  recordFeedback(feedback: Omit<SteeringFeedback, "id" | "recordedAt">): SteeringFeedback {
    const record: SteeringFeedback = {
      id: randomUUID(),
      ...feedback,
      recordedAt: new Date(),
    };
    this.feedbacks.push(record);
    return record;
  }

  getAuditTrail(): DecisionLog[] {
    return [...this.decisionLogs].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }

  getProposalById(id: string): SteeringProposal | undefined {
    return this.proposals.get(id);
  }

  detectConflicts(
    proposalId: string,
    thresholdMs: number = 3_600_000
  ): CalendarEvent[] {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);
    const proposedTime = proposal.scheduledAt.getTime();
    return [...this.events.values()].filter((event) => {
      if (event.id === proposal.eventId) return false;
      return Math.abs(event.scheduledAt.getTime() - proposedTime) < thresholdMs;
    });
  }

  getEvent(eventId: string): CalendarEvent | undefined {
    return this.events.get(eventId);
  }

  listEvents(): CalendarEvent[] {
    return [...this.events.values()];
  }
}
