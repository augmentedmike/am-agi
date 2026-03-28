import { NextRequest, NextResponse } from 'next/server';
import { execSync, spawnSync } from 'child_process';
import { getDb } from '@/db/client';
import { getAllSettings, setSetting } from '@/db/settings';
import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AM_ROOT = path.resolve(process.cwd(), '..');
const REFLECTION_BIN = path.join(AM_ROOT, 'bin/reflection');
const PLIST_ID = 'bot.helloam.reflection';
const PLIST_PATH = path.join(os.homedir(), `Library/LaunchAgents/${PLIST_ID}.plist`);
const LOG_PATH = path.join(AM_ROOT, 'workspaces/memory/consolidate.log');

function parseCronTime(timeStr: string): { hour: number; minute: number } {
  const [h, m] = (timeStr || '02:00').split(':').map(Number);
  return { hour: isNaN(h) ? 2 : h, minute: isNaN(m) ? 0 : m };
}

function buildPlist(hour: number, minute: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_ID}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${REFLECTION_BIN}</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${hour}</integer>
    <key>Minute</key>
    <integer>${minute}</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${LOG_PATH}</string>
  <key>StandardErrorPath</key>
  <string>${LOG_PATH}</string>
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
`;
}

const LT_DB_PATH = path.join(AM_ROOT, 'workspaces/memory/lt/memory.db');

function getMemoryDb() {
  if (!fs.existsSync(LT_DB_PATH)) return null;
  const mdb = new BetterSqlite3(LT_DB_PATH);
  mdb.pragma('journal_mode = WAL');
  return mdb;
}

// GET — current schedule + last run excerpt + run history
// ?history=1  returns full run records
export async function GET(req: NextRequest) {
  const { db, sqlite } = getDb();
  const settings = getAllSettings(db);
  const reflectionTime = settings.reflection_time ?? '02:00';
  const installed = fs.existsSync(PLIST_PATH);

  let lastRun = '';
  if (fs.existsSync(LOG_PATH)) {
    try {
      const lines = fs.readFileSync(LOG_PATH, 'utf8').trim().split('\n');
      lastRun = lines.slice(-8).join('\n');
    } catch { /* ignore */ }
  }

  const showHistory = req.nextUrl.searchParams.get('history') === '1';
  let runs: unknown[] = [];
  if (showHistory) {
    const mdb = getMemoryDb();
    if (mdb) {
      try {
        runs = mdb.prepare('SELECT id, run_at, skipped, promoted, kept, dropped, log_path, details FROM reflection_runs ORDER BY run_at DESC LIMIT 30').all();
      } catch { /* table may not exist yet */ }
      mdb.close();
    }
  }

  return NextResponse.json({ reflectionTime, installed, lastRun, ...(showHistory ? { runs } : {}) });
}

// POST { action: 'install' | 'run-now' | 'uninstall', time?: 'HH:MM' }
export async function POST(req: NextRequest) {
  const body = await req.json() as { action: string; time?: string };
  const { db, sqlite } = getDb();

  if (body.action === 'run-now') {
    if (!fs.existsSync(REFLECTION_BIN)) {
      return NextResponse.json({ error: 'reflection binary not found' }, { status: 500 });
    }
    try {
      const result = spawnSync('/bin/bash', [REFLECTION_BIN], { encoding: 'utf8', timeout: 120_000 });
      return NextResponse.json({ ok: true, stdout: result.stdout, stderr: result.stderr });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  if (body.action === 'install') {
    const time = body.time ?? '02:00';
    setSetting(db, 'reflection_time', time);
    const { hour, minute } = parseCronTime(time);

    // Unload existing if present
    if (fs.existsSync(PLIST_PATH)) {
      try { execSync(`launchctl unload "${PLIST_PATH}" 2>/dev/null`, { stdio: 'ignore' }); } catch { /* ok */ }
    }

    fs.mkdirSync(path.dirname(PLIST_PATH), { recursive: true });
    fs.writeFileSync(PLIST_PATH, buildPlist(hour, minute), 'utf8');

    try {
      execSync(`launchctl load "${PLIST_PATH}"`, { stdio: 'ignore' });
      return NextResponse.json({ ok: true, plist: PLIST_PATH, time });
    } catch (err) {
      return NextResponse.json({ ok: false, plist: PLIST_PATH, time, warn: String(err) });
    }
  }

  if (body.action === 'uninstall') {
    if (fs.existsSync(PLIST_PATH)) {
      try { execSync(`launchctl unload "${PLIST_PATH}" 2>/dev/null`, { stdio: 'ignore' }); } catch { /* ok */ }
      fs.unlinkSync(PLIST_PATH);
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
