import { describe, it, expect, beforeEach } from "bun:test";
import {
  CalendarPlugin,
  CalendarEvent,
  SteeringProposal,
  SteeringFeedback,
  SteeringInterpretability,
  DecisionLog,
} from "./index.ts";

describe("CalendarPlugin", () => {
  let plugin: CalendarPlugin;
  const t0 = new Date("2026-05-01T10:00:00Z");
  const t1 = new Date("2026-05-01T11:00:00Z");
  const t2 = new Date("2026-05-01T14:00:00Z");

  beforeEach(() => {
    plugin = new CalendarPlugin();
  });

  // ── createEvent ───────────────────────────────────────────────────────────

  it("createEvent returns event with UUID id and backlog state", () => {
    const ev = plugin.createEvent("Team sync", t0);
    expect(ev.id).toBeString();
    expect(ev.title).toBe("Team sync");
    expect(ev.scheduledAt).toEqual(t0);
    expect(ev.recurrenceRule).toBeUndefined();
  });

  it("createEvent stores recurrenceRule when provided", () => {
    const ev = plugin.createEvent("Weekly standup", t0, "FREQ=WEEKLY");
    expect(ev.recurrenceRule).toBe("FREQ=WEEKLY");
  });

  it("createEvent appends a DecisionLog entry with action 'created'", () => {
    const ev = plugin.createEvent("Team sync", t0);
    const logs = plugin.getAuditTrail();
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe("created");
    expect(logs[0].eventId).toBe(ev.id);
  });

  // ── proposeSchedule ───────────────────────────────────────────────────────

  it("proposeSchedule returns a pending SteeringProposal", () => {
    const ev = plugin.createEvent("Team sync", t0);
    const proposal = plugin.proposeSchedule(ev.id, t1);
    expect(proposal.id).toBeString();
    expect(proposal.eventId).toBe(ev.id);
    expect(proposal.scheduledAt).toEqual(t1);
    expect(proposal.status).toBe("pending");
  });

  it("proposeSchedule stores interpretability context", () => {
    const ev = plugin.createEvent("Team sync", t0);
    const interp: SteeringInterpretability = {
      rationale: "Best slot after lunch",
      confidence: 0.9,
    };
    const proposal = plugin.proposeSchedule(ev.id, t1, interp);
    expect(proposal.interpretability).toEqual(interp);
  });

  it("proposeSchedule appends a DecisionLog entry with action 'proposed'", () => {
    const ev = plugin.createEvent("Team sync", t0);
    const proposal = plugin.proposeSchedule(ev.id, t1);
    const logs = plugin.getAuditTrail().filter((l) => l.action === "proposed");
    expect(logs).toHaveLength(1);
    expect(logs[0].proposalId).toBe(proposal.id);
  });

  it("proposeSchedule throws when event not found", () => {
    expect(() => plugin.proposeSchedule("bad-id", t1)).toThrow("Event not found");
  });

  // ── approveProposal ───────────────────────────────────────────────────────

  it("approveProposal updates event scheduledAt and returns updated event", () => {
    const ev = plugin.createEvent("Team sync", t0);
    const proposal = plugin.proposeSchedule(ev.id, t1);
    const updated = plugin.approveProposal(proposal.id);
    expect(updated.scheduledAt).toEqual(t1);
  });

  it("approveProposal appends a DecisionLog entry with action 'approved'", () => {
    const ev = plugin.createEvent("Team sync", t0);
    const proposal = plugin.proposeSchedule(ev.id, t1);
    plugin.approveProposal(proposal.id);
    const logs = plugin.getAuditTrail().filter((l) => l.action === "approved");
    expect(logs).toHaveLength(1);
    expect(logs[0].proposalId).toBe(proposal.id);
  });

  it("approveProposal throws when proposal not found", () => {
    expect(() => plugin.approveProposal("bad-id")).toThrow("Proposal not found");
  });

  // ── rejectProposal ────────────────────────────────────────────────────────

  it("rejectProposal marks proposal as rejected", () => {
    const ev = plugin.createEvent("Team sync", t0);
    const proposal = plugin.proposeSchedule(ev.id, t1);
    const rejected = plugin.rejectProposal(proposal.id, "Too early");
    expect(rejected.status).toBe("rejected");
    expect(rejected.reason).toBe("Too early");
  });

  it("rejectProposal appends a DecisionLog entry with action 'rejected'", () => {
    const ev = plugin.createEvent("Team sync", t0);
    const proposal = plugin.proposeSchedule(ev.id, t1);
    plugin.rejectProposal(proposal.id);
    const logs = plugin.getAuditTrail().filter((l) => l.action === "rejected");
    expect(logs).toHaveLength(1);
  });

  it("rejectProposal throws when proposal not found", () => {
    expect(() => plugin.rejectProposal("bad-id")).toThrow("Proposal not found");
  });

  // ── editProposal ──────────────────────────────────────────────────────────

  it("editProposal updates the proposal scheduledAt", () => {
    const ev = plugin.createEvent("Team sync", t0);
    const proposal = plugin.proposeSchedule(ev.id, t1);
    const edited = plugin.editProposal(proposal.id, t2);
    expect(edited.scheduledAt).toEqual(t2);
    expect(edited.status).toBe("edited");
  });

  it("editProposal appends a DecisionLog entry with action 'edited'", () => {
    const ev = plugin.createEvent("Team sync", t0);
    const proposal = plugin.proposeSchedule(ev.id, t1);
    plugin.editProposal(proposal.id, t2);
    const logs = plugin.getAuditTrail().filter((l) => l.action === "edited");
    expect(logs).toHaveLength(1);
  });

  it("editProposal throws when proposal not found", () => {
    expect(() => plugin.editProposal("bad-id", t2)).toThrow("Proposal not found");
  });

  // ── recordFeedback ────────────────────────────────────────────────────────

  it("recordFeedback stores a SteeringFeedback record and returns it", () => {
    const ev = plugin.createEvent("Team sync", t0);
    const proposal = plugin.proposeSchedule(ev.id, t1);
    const fb = plugin.recordFeedback({
      proposalId: proposal.id,
      feedback: "Prefer afternoon slots",
      rating: 4,
    });
    expect(fb.id).toBeString();
    expect(fb.feedback).toBe("Prefer afternoon slots");
    expect(fb.rating).toBe(4);
  });

  // ── getAuditTrail ─────────────────────────────────────────────────────────

  it("getAuditTrail returns all DecisionLog entries in chronological order", () => {
    const ev = plugin.createEvent("Team sync", t0);
    const proposal = plugin.proposeSchedule(ev.id, t1);
    plugin.approveProposal(proposal.id);
    const trail = plugin.getAuditTrail();
    expect(trail.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < trail.length; i++) {
      expect(trail[i].timestamp.getTime()).toBeGreaterThanOrEqual(
        trail[i - 1].timestamp.getTime()
      );
    }
  });

  // ── getProposalById ───────────────────────────────────────────────────────

  it("getProposalById returns the matching proposal", () => {
    const ev = plugin.createEvent("Team sync", t0);
    const proposal = plugin.proposeSchedule(ev.id, t1);
    expect(plugin.getProposalById(proposal.id)).toEqual(proposal);
  });

  it("getProposalById returns undefined for unknown id", () => {
    expect(plugin.getProposalById("unknown")).toBeUndefined();
  });

  // ── detectConflicts ───────────────────────────────────────────────────────

  it("detectConflicts returns events within default 1-hour threshold", () => {
    const ev1 = plugin.createEvent("Team sync", t0);
    const ev2 = plugin.createEvent("Design review", new Date(t0.getTime() + 30 * 60 * 1000)); // 30 min after
    const proposal = plugin.proposeSchedule(ev1.id, t0);
    const conflicts = plugin.detectConflicts(proposal.id);
    expect(conflicts.some((e) => e.id === ev2.id)).toBe(true);
  });

  it("detectConflicts excludes the event being proposed", () => {
    const ev1 = plugin.createEvent("Team sync", t0);
    const proposal = plugin.proposeSchedule(ev1.id, t0);
    const conflicts = plugin.detectConflicts(proposal.id);
    expect(conflicts.every((e) => e.id !== ev1.id)).toBe(true);
  });

  it("detectConflicts respects custom threshold", () => {
    const ev1 = plugin.createEvent("Team sync", t0);
    const ev2 = plugin.createEvent("Design review", new Date(t0.getTime() + 30 * 60 * 1000));
    const proposal = plugin.proposeSchedule(ev1.id, t0);
    // 10-minute threshold — ev2 is 30 min away, should not conflict
    const conflicts = plugin.detectConflicts(proposal.id, 10 * 60 * 1000);
    expect(conflicts.every((e) => e.id !== ev2.id)).toBe(true);
  });

  it("detectConflicts returns empty array when no conflicts", () => {
    const ev1 = plugin.createEvent("Team sync", t0);
    const ev2 = plugin.createEvent("Design review", t2); // 4 hours away
    const proposal = plugin.proposeSchedule(ev1.id, t0);
    const conflicts = plugin.detectConflicts(proposal.id);
    expect(conflicts.every((e) => e.id !== ev2.id)).toBe(true);
  });

  it("detectConflicts throws when proposal not found", () => {
    expect(() => plugin.detectConflicts("bad-id")).toThrow("Proposal not found");
  });
});
