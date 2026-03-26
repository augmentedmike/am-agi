import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { runMigrations } from '@/db/migrations';
import { getAllSettings } from '@/db/settings';
import { listTeamMembers } from '@/db/team';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReportCard = { id: string; title: string; priority?: string; state?: string; shippedAt?: string | null; lastLog?: { timestamp: string; message: string } | null };

type Report = {
  date: string;
  period: { from: string; to: string };
  shipped: ReportCard[];
  updated: ReportCard[];
  inProgress: ReportCard[];
  stats: { shipped: number; updated: number; inProgress: number };
};

function formatTextBody(report: Report): string {
  const lines: string[] = [
    `AM Daily Report — ${report.date}`,
    `Period: ${new Date(report.period.from).toLocaleString()} → ${new Date(report.period.to).toLocaleString()}`,
    '',
  ];

  lines.push(`Shipped (${report.stats.shipped})`);
  if (report.shipped.length === 0) {
    lines.push('  (none)');
  } else {
    for (const c of report.shipped) {
      lines.push(`  - [${c.id.slice(0, 8)}] ${c.title}`);
    }
  }

  lines.push('');
  lines.push(`Updated (${report.stats.updated})`);
  if (report.updated.length === 0) {
    lines.push('  (none)');
  } else {
    for (const c of report.updated) {
      const log = c.lastLog ? ` — "${c.lastLog.message}"` : '';
      lines.push(`  - [${c.state}] ${c.title}${log}`);
    }
  }

  lines.push('');
  lines.push(`In Progress (${report.stats.inProgress})`);
  if (report.inProgress.length === 0) {
    lines.push('  (none)');
  } else {
    for (const c of report.inProgress) {
      lines.push(`  - [${c.priority}] ${c.title}`);
    }
  }

  return lines.join('\n');
}

function formatHtmlBody(report: Report): string {
  const row = (c: ReportCard, extra = '') =>
    `<tr><td style="padding:4px 8px;font-family:monospace;font-size:12px;color:#888">${c.id.slice(0, 8)}</td><td style="padding:4px 8px">${c.title}</td>${extra}</tr>`;

  const shippedRows = report.shipped.length
    ? report.shipped.map(c => row(c)).join('')
    : '<tr><td colspan="2" style="padding:4px 8px;color:#888">(none)</td></tr>';

  const updatedRows = report.updated.length
    ? report.updated.map(c => row(c, `<td style="padding:4px 8px;color:#888">${c.state}</td><td style="padding:4px 8px;font-size:12px;color:#aaa">${c.lastLog?.message ?? ''}</td>`)).join('')
    : '<tr><td colspan="4" style="padding:4px 8px;color:#888">(none)</td></tr>';

  const inProgressRows = report.inProgress.length
    ? report.inProgress.map(c => row(c, `<td style="padding:4px 8px;color:#888">${c.priority}</td>`)).join('')
    : '<tr><td colspan="3" style="padding:4px 8px;color:#888">(none)</td></tr>';

  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;color:#222;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#e91e8c">AM Daily Report — ${report.date}</h2>
  <p style="color:#888;font-size:13px">Period: ${new Date(report.period.from).toLocaleString()} → ${new Date(report.period.to).toLocaleString()}</p>

  <h3>Shipped (${report.stats.shipped})</h3>
  <table style="border-collapse:collapse;width:100%">${shippedRows}</table>

  <h3>Updated (${report.stats.updated})</h3>
  <table style="border-collapse:collapse;width:100%">${updatedRows}</table>

  <h3>In Progress (${report.stats.inProgress})</h3>
  <table style="border-collapse:collapse;width:100%">${inProgressRows}</table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);

  const body = await req.json().catch(() => ({})) as { since?: string };
  const settings = getAllSettings(db);

  // Validate SMTP config
  if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass || !settings.smtp_from) {
    return NextResponse.json({ error: 'smtp not configured' }, { status: 422 });
  }

  // Fetch report
  const sinceParam = body.since ? `?since=${encodeURIComponent(body.since)}` : '';
  const boardUrl = process.env.BOARD_URL ?? 'http://localhost:4200';
  const reportRes = await fetch(`${boardUrl}/api/report${sinceParam}`);
  if (!reportRes.ok) {
    return NextResponse.json({ error: 'failed to fetch report' }, { status: 500 });
  }
  const report = await reportRes.json() as Report;

  // Get recipients
  const members = listTeamMembers(db).filter(m => m.email);
  if (members.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, reason: 'no team members with email' });
  }

  // Build transporter
  const transporter = nodemailer.createTransport({
    host: settings.smtp_host,
    port: Number(settings.smtp_port) || 587,
    secure: settings.smtp_secure === 'true',
    auth: { user: settings.smtp_user, pass: settings.smtp_pass },
  });

  const subject = `AM Daily Report — ${report.date} (${report.stats.shipped} shipped, ${report.stats.inProgress} in progress)`;
  const text = formatTextBody(report);
  const html = formatHtmlBody(report);

  let sent = 0;
  let skipped = 0;

  for (const member of members) {
    try {
      await transporter.sendMail({
        from: settings.smtp_from,
        to: member.email,
        subject,
        text,
        html,
      });
      sent++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ sent, skipped });
}
