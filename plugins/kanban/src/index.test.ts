import { expect, test, describe, beforeEach } from "bun:test";
import {
  KanbanPlugin,
  type KanbanCard,
  type KanbanState,
  type KanbanPriority,
  type SteeringRequest,
  type DecisionLog,
} from "./index";

describe("KanbanPlugin", () => {
  let plugin: KanbanPlugin;

  beforeEach(() => {
    plugin = new KanbanPlugin();
  });

  // ── createCard ───────────────────────────────────────────────────────────────

  describe("createCard()", () => {
    test("creates a card with a UUID id", () => {
      const card = plugin.createCard("Test card");
      expect(card.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    test("sets state to backlog", () => {
      const card = plugin.createCard("Backlog card");
      expect(card.state).toBe("backlog");
    });

    test("uses default priority of normal", () => {
      const card = plugin.createCard("Default prio");
      expect(card.priority).toBe("normal");
    });

    test("respects provided priority", () => {
      const card = plugin.createCard("High prio", "high");
      expect(card.priority).toBe("high");
    });

    test("appends a DecisionLog entry with action=created", () => {
      const card = plugin.createCard("Logged card");
      const logs = plugin.getDecisionLogs(card.id);
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe("created");
      expect(logs[0].cardId).toBe(card.id);
      expect(logs[0].to).toBe("backlog");
    });

    test("multiple cards produce independent logs", () => {
      const a = plugin.createCard("A");
      const b = plugin.createCard("B");
      expect(plugin.getDecisionLogs(a.id)).toHaveLength(1);
      expect(plugin.getDecisionLogs(b.id)).toHaveLength(1);
    });
  });

  // ── moveCard ────────────────────────────────────────────────────────────────

  describe("moveCard()", () => {
    test("moves backlog → in-progress", () => {
      const card = plugin.createCard("Move me");
      plugin.moveCard(card.id, "in-progress");
      expect(plugin.getCard(card.id)?.state).toBe("in-progress");
    });

    test("moves in-progress → in-review", () => {
      const card = plugin.createCard("Move me");
      plugin.moveCard(card.id, "in-progress");
      plugin.moveCard(card.id, "in-review");
      expect(plugin.getCard(card.id)?.state).toBe("in-review");
    });

    test("moves in-review → shipped", () => {
      const card = plugin.createCard("Move me");
      plugin.moveCard(card.id, "in-progress");
      plugin.moveCard(card.id, "in-review");
      plugin.moveCard(card.id, "shipped");
      expect(plugin.getCard(card.id)?.state).toBe("shipped");
    });

    test("throws on invalid transition backlog → shipped", () => {
      const card = plugin.createCard("Bad jump");
      expect(() => plugin.moveCard(card.id, "shipped")).toThrow();
    });

    test("throws on backward transition in-progress → backlog", () => {
      const card = plugin.createCard("Backward");
      plugin.moveCard(card.id, "in-progress");
      expect(() => plugin.moveCard(card.id, "backlog")).toThrow();
    });

    test("throws when card does not exist", () => {
      expect(() => plugin.moveCard("no-such-id", "in-progress")).toThrow();
    });

    test("appends a DecisionLog entry with action=moved", () => {
      const card = plugin.createCard("Log me");
      plugin.moveCard(card.id, "in-progress");
      const logs = plugin.getDecisionLogs(card.id);
      const moved = logs.find((l) => l.action === "moved");
      expect(moved).toBeDefined();
      expect(moved?.from).toBe("backlog");
      expect(moved?.to).toBe("in-progress");
    });
  });

  // ── requestSteering ─────────────────────────────────────────────────────────

  describe("requestSteering()", () => {
    test("stores a SteeringRequest and returns it", () => {
      const card = plugin.createCard("Steer me");
      const req = plugin.requestSteering(card.id, "backlog", "in-progress", "urgent");
      expect(req.cardId).toBe(card.id);
      expect(req.from).toBe("backlog");
      expect(req.to).toBe("in-progress");
      expect(req.reason).toBe("urgent");
      expect(req.id).toBeDefined();
    });

    test("works without a reason", () => {
      const card = plugin.createCard("No reason");
      const req = plugin.requestSteering(card.id, "backlog", "in-progress");
      expect(req.reason).toBeUndefined();
    });

    test("appends a DecisionLog entry with action=steering-requested", () => {
      const card = plugin.createCard("Steer log");
      plugin.requestSteering(card.id, "backlog", "in-progress", "why not");
      const logs = plugin.getDecisionLogs(card.id);
      const sr = logs.find((l) => l.action === "steering-requested");
      expect(sr).toBeDefined();
      expect(sr?.reason).toBe("why not");
    });

    test("throws when card does not exist", () => {
      expect(() =>
        plugin.requestSteering("nope", "backlog", "in-progress")
      ).toThrow();
    });
  });

  // ── getDecisionLogs ─────────────────────────────────────────────────────────

  describe("getDecisionLogs()", () => {
    test("returns all logs when no cardId given", () => {
      plugin.createCard("A");
      plugin.createCard("B");
      expect(plugin.getDecisionLogs().length).toBeGreaterThanOrEqual(2);
    });

    test("filters by cardId", () => {
      const a = plugin.createCard("A");
      const b = plugin.createCard("B");
      const logsA = plugin.getDecisionLogs(a.id);
      expect(logsA.every((l) => l.cardId === a.id)).toBe(true);
    });

    test("returns empty array for unknown cardId", () => {
      expect(plugin.getDecisionLogs("phantom")).toHaveLength(0);
    });
  });
});
