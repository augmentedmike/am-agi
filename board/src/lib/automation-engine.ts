import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/db/schema';
import { listRules } from '@/db/automations';
import { createCard, updateCard, moveCard } from '@/db/cards';
import { getAllSettings } from '@/db/settings';
import { sendEmail } from './email';
import { CardState, CardPriority } from '@/db/schema';

type Db = BetterSQLite3Database<typeof schema>;

export type CardEventData = {
  id: string;
  title: string;
  state: string;
  priority: string;
  project_id?: string | null;
};

export type AutomationEvent =
  | { type: 'card_created'; card: CardEventData }
  | { type: 'card_state_change'; card: CardEventData; fromState: string; toState: string }
  | { type: 'email_inbound'; from: string; subject: string; body: string };

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, key) => vars[key] ?? '');
}

function buildCardVars(card: CardEventData): Record<string, string> {
  return {
    'card.id': card.id,
    'card.title': card.title,
    'card.state': card.state,
    'card.priority': card.priority,
    'card.project_id': card.project_id ?? '',
  };
}

export async function evaluateRules(db: Db, event: AutomationEvent): Promise<void> {
  const projectId = event.type !== 'email_inbound' ? (event.card.project_id ?? undefined) : undefined;
  const allRules = listRules(db);
  const rules = allRules.filter(r => {
    if (!r.enabled) return false;
    if (r.triggerType !== event.type) return false;
    // project_id filter: if rule has a project_id, only match that project
    if (r.projectId && projectId && r.projectId !== projectId) return false;
    return true;
  });

  for (const rule of rules) {
    const cond = rule.triggerConditions as schema.AutomationTriggerConditions;

    // Condition matching per event type
    if (event.type === 'card_state_change') {
      if (cond.fromState && cond.fromState !== event.fromState) continue;
      if (cond.toState && cond.toState !== event.toState) continue;
      if (cond.state && cond.state !== event.card.state) continue;
      if (cond.priority && cond.priority !== event.card.priority) continue;
      if (cond.project_id && cond.project_id !== event.card.project_id) continue;
    } else if (event.type === 'card_created') {
      if (cond.priority && cond.priority !== event.card.priority) continue;
      if (cond.project_id && cond.project_id !== event.card.project_id) continue;
    }
    // email_inbound: no condition filtering beyond trigger type

    const params = rule.actionParams as schema.AutomationActionParams;

    try {
      await dispatchAction(db, rule.actionType as schema.AutomationActionType, params, event);
    } catch (err) {
      // log and continue — don't let one failing action block others
      console.error(`[automation] rule ${rule.id} action failed:`, err);
    }
  }
}

async function dispatchAction(
  db: Db,
  actionType: schema.AutomationActionType,
  params: schema.AutomationActionParams,
  event: AutomationEvent
): Promise<void> {
  const cardVars: Record<string, string> =
    event.type !== 'email_inbound' ? buildCardVars(event.card) : {
      'email.from': event.from,
      'email.subject': event.subject,
      'email.body': event.body,
    };

  switch (actionType) {
    case 'send_email': {
      const settings = getAllSettings(db);
      if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass || !settings.smtp_from) {
        console.warn('[automation] send_email: SMTP not configured');
        return;
      }
      const to = params.to ? interpolate(params.to, cardVars) : settings.smtp_from;
      const subject = interpolate(params.subject ?? '(no subject)', cardVars);
      const body = interpolate(params.body ?? '', cardVars);
      await sendEmail(
        {
          smtp_host: settings.smtp_host,
          smtp_port: settings.smtp_port,
          smtp_secure: settings.smtp_secure,
          smtp_user: settings.smtp_user,
          smtp_pass: settings.smtp_pass,
          smtp_from: settings.smtp_from,
        },
        { to, subject, text: body }
      );
      break;
    }

    case 'create_card': {
      const title = interpolate(params.title ?? 'Untitled', cardVars);
      const newCard = createCard(db, {
        title,
        priority: (params.priority as CardPriority) ?? 'normal',
        projectId: params.project_id ?? (event.type !== 'email_inbound' ? event.card.project_id : undefined),
      });
      // Move to requested state if specified (createCard always starts in backlog)
      if (params.state) {
        const targetState = interpolate(params.state, cardVars) as CardState;
        if (targetState && targetState !== 'backlog') {
          moveCard(db, newCard.id, targetState);
        }
      }
      break;
    }

    case 'move_card': {
      if (event.type === 'email_inbound') return;
      const newState = interpolate(params.to_state ?? '', cardVars) as CardState;
      if (newState) moveCard(db, event.card.id, newState);
      break;
    }

    case 'log_entry': {
      if (event.type === 'email_inbound') return;
      const message = interpolate(params.message ?? '', cardVars);
      updateCard(db, event.card.id, {
        workLogEntry: { timestamp: new Date().toISOString(), message },
      });
      break;
    }
  }
}
