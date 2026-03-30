import { describe, it, expect, beforeEach, spyOn } from 'bun:test';
import { createTestDb } from '@/db/client.test';
import { runMigrations } from '@/db/migrations';
import { createCard, getCard, listCards } from '@/db/cards';
import { createRule } from '@/db/automations';
import { evaluateRules } from '@/lib/automation-engine';
import { setSetting } from '@/db/settings';

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];

beforeEach(() => {
  const instance = createTestDb();
  db = instance.db;
  sqlite = instance.sqlite;
  runMigrations(db, sqlite);
});

describe('automation-engine', () => {
  describe('card_state_change → send_email', () => {
    it('calls sendEmail when a matching rule fires', async () => {
      createRule(db, {
        name: 'notify on in-progress',
        triggerType: 'card_state_change',
        triggerConditions: { toState: 'in-progress' },
        actionType: 'send_email',
        actionParams: {
          to: 'mike@example.com',
          subject: 'Card {{card.title}} moved',
          body: 'State: {{card.state}}',
        },
      });

      const card = createCard(db, { title: 'Test Card' });

      // Provide SMTP settings
      setSetting(db, 'smtp_host', 'smtp.example.com');
      setSetting(db, 'smtp_user', 'user@example.com');
      setSetting(db, 'smtp_pass', 'secret');
      setSetting(db, 'smtp_from', 'noreply@example.com');

      const emailModule = await import('@/lib/email');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let capturedOpts: any = null;
      const spy = spyOn(emailModule, 'sendEmail').mockImplementation(async (_settings, opts) => {
        capturedOpts = opts;
      });

      await evaluateRules(db, {
        type: 'card_state_change',
        card: {
          id: card.id,
          title: card.title,
          state: 'in-progress',
          priority: card.priority,
          project_id: card.projectId,
        },
        fromState: 'backlog',
        toState: 'in-progress',
      });

      expect(spy).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(capturedOpts?.subject).toBe('Card Test Card moved');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(capturedOpts?.text).toBe('State: in-progress');

      spy.mockRestore();
    });

    it('does not fire when toState does not match condition', async () => {
      createRule(db, {
        name: 'notify on shipped only',
        triggerType: 'card_state_change',
        triggerConditions: { toState: 'shipped' },
        actionType: 'send_email',
        actionParams: { to: 'mike@example.com', subject: 'shipped', body: '' },
      });

      const card = createCard(db, { title: 'Test Card' });
      const emailModule = await import('@/lib/email');
      const spy = spyOn(emailModule, 'sendEmail').mockImplementation(async () => {});

      await evaluateRules(db, {
        type: 'card_state_change',
        card: { id: card.id, title: card.title, state: 'in-progress', priority: card.priority, project_id: card.projectId },
        fromState: 'backlog',
        toState: 'in-progress',
      });

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('card_created → log_entry', () => {
    it('appends a work log entry when a matching rule fires', async () => {
      createRule(db, {
        name: 'log on create',
        triggerType: 'card_created',
        triggerConditions: {},
        actionType: 'log_entry',
        actionParams: { message: 'Card {{card.title}} was created with priority {{card.priority}}' },
      });

      const card = createCard(db, { title: 'New Task', priority: 'high' });

      await evaluateRules(db, {
        type: 'card_created',
        card: {
          id: card.id,
          title: card.title,
          state: card.state,
          priority: card.priority,
          project_id: card.projectId,
        },
      });

      const updated = getCard(db, card.id);
      expect(updated?.workLog).toHaveLength(1);
      expect(updated?.workLog[0].message).toBe('Card New Task was created with priority high');
    });

    it('does not fire for disabled rules', async () => {
      createRule(db, {
        name: 'disabled rule',
        enabled: false,
        triggerType: 'card_created',
        triggerConditions: {},
        actionType: 'log_entry',
        actionParams: { message: 'should not appear' },
      });

      const card = createCard(db, { title: 'Another Task' });

      await evaluateRules(db, {
        type: 'card_created',
        card: { id: card.id, title: card.title, state: card.state, priority: card.priority, project_id: card.projectId },
      });

      const updated = getCard(db, card.id);
      expect(updated?.workLog).toHaveLength(0);
    });
  });

  describe('email_inbound → create_card', () => {
    it('creates a card from inbound email via automation rule', async () => {
      createRule(db, {
        name: 'create card from email',
        triggerType: 'email_inbound',
        actionType: 'create_card',
        actionParams: {
          title: 'Email: {{email.subject}}',
          priority: 'high',
        },
      });

      const before = listCards(db).length;

      await evaluateRules(db, {
        type: 'email_inbound',
        from: 'sender@example.com',
        subject: 'Need help with onboarding',
        body: 'Hi, I need help.',
      });

      const cards = listCards(db);
      expect(cards.length).toBe(before + 1);
      const newCard = cards[cards.length - 1];
      expect(newCard.title).toBe('Email: Need help with onboarding');
      expect(newCard.priority).toBe('high');
    });

    it('interpolates email vars into card title', async () => {
      createRule(db, {
        name: 'create from email with from',
        triggerType: 'email_inbound',
        actionType: 'create_card',
        actionParams: {
          title: 'From {{email.from}}: {{email.subject}}',
        },
      });

      await evaluateRules(db, {
        type: 'email_inbound',
        from: 'alice@example.com',
        subject: 'Bug report',
        body: 'There is a bug.',
      });

      const cards = listCards(db);
      const created = cards.find(c => c.title.startsWith('From alice'));
      expect(created).toBeTruthy();
      expect(created!.title).toBe('From alice@example.com: Bug report');
    });
  });
});
