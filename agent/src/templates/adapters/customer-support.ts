import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { ProjectTemplateAdapter } from '../index';
import type { TemplateSpec } from '../spec';

const spec: TemplateSpec = {
  type: 'customer-support',
  displayName: 'Customer Support',
  description: 'AI-assisted customer support — ticket inbox + Claude reply drafting',
  pipeline: {
    columns: [
      { id: 'incoming', label: 'Incoming' },
      { id: 'triage', label: 'Triage' },
      { id: 'investigating', label: 'Investigating' },
      { id: 'waiting', label: 'Waiting on Customer' },
      { id: 'resolved', label: 'Resolved' },
      { id: 'closed', label: 'Closed' },
    ],
    transitions: [
      { from: 'incoming', to: 'triage', gates: [] },
      { from: 'triage', to: 'investigating', gates: [] },
      { from: 'investigating', to: 'waiting', gates: [] },
      { from: 'waiting', to: 'investigating', gates: [] },
      { from: 'investigating', to: 'resolved', gates: [] },
      { from: 'resolved', to: 'closed', gates: [] },
    ],
  },
  cardTypes: [{ id: 'ticket', label: 'Ticket', fields: [
    { id: 'email', label: 'Email', type: 'text' as const },
    { id: 'severity', label: 'Severity', type: 'select' as const, options: ['P0', 'P1', 'P2', 'P3'] },
    { id: 'product', label: 'Product', type: 'text' as const },
  ] }],
  fields: [],
};

export const customerSupportAdapter: ProjectTemplateAdapter = {
  type: 'customer-support',
  displayName: 'Customer Support',
  description: 'AI-assisted customer support — ticket inbox + Claude reply drafting',
  spec,
  scaffold(name: string, dest: string): void {
    const dir = (path: string) => mkdirSync(join(dest, path), { recursive: true });
    const file = (path: string, content: string) => writeFileSync(join(dest, path), content, 'utf8');

    dir('src/app/api/chat');
    dir('src/components');
    dir('public');

    file(
      'package.json',
      JSON.stringify(
        {
          name,
          version: '0.1.0',
          private: true,
          scripts: {
            dev: 'next dev --turbopack',
            build: 'next build',
            start: 'next start',
            lint: 'next lint',
          },
          dependencies: {
            '@anthropic-ai/sdk': '^0.39.0',
            next: '^15.0.0',
            react: '^19.0.0',
            'react-dom': '^19.0.0',
          },
          devDependencies: {
            '@tailwindcss/postcss': '^4',
            '@types/node': '^20',
            '@types/react': '^19',
            '@types/react-dom': '^19',
            tailwindcss: '^4',
            typescript: '^5',
          },
        },
        null,
        2,
      ) + '\n',
    );

    file(
      'tsconfig.json',
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            lib: ['dom', 'dom.iterable', 'esnext'],
            allowJs: false,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: 'esnext',
            moduleResolution: 'bundler',
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: 'preserve',
            incremental: true,
            plugins: [{ name: 'next' }],
            paths: { '@/*': ['./src/*'] },
          },
          include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
          exclude: ['node_modules'],
        },
        null,
        2,
      ) + '\n',
    );

    file(
      'next.config.ts',
      `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
`,
    );

    file(
      'postcss.config.mjs',
      `const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
`,
    );

    file(
      'vercel.json',
      JSON.stringify(
        {
          framework: 'nextjs',
          buildCommand: 'bun run build',
          devCommand: 'bun run dev',
          installCommand: 'bun install',
        },
        null,
        2,
      ) + '\n',
    );

    file(
      '.gitignore',
      `.next/
out/
node_modules/
.env*.local
.env
.vercel
*.tsbuildinfo
`,
    );

    file(
      '.env.example',
      `# Get your key at https://console.anthropic.com
ANTHROPIC_API_KEY=
`,
    );

    file('src/app/globals.css', `@import "tailwindcss";\n`);

    file(
      'src/app/layout.tsx',
      `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "${name}",
  description: "AI-assisted customer support",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen">{children}</body>
    </html>
  );
}
`,
    );

    file(
      'src/app/page.tsx',
      `"use client";

import { useState } from "react";
import { TicketList, type Ticket } from "@/components/TicketList";

export default function Home() {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  async function draftReply() {
    if (!selectedTicket) return;
    setLoading(true);
    setReply("");
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket: selectedTicket }),
    });
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) { setLoading(false); return; }
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      setReply((prev) => prev + decoder.decode(value));
    }
    setLoading(false);
  }

  return (
    <main className="max-w-5xl mx-auto p-8 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">${name}</h1>
        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full">Customer Support</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Tickets</h2>
          <TicketList onSelect={setSelectedTicket} selected={selectedTicket} />
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
              {selectedTicket ? \`Reply to #\${selectedTicket.id}\` : "Reply"}
            </h2>
            <button
              onClick={draftReply}
              disabled={!selectedTicket || loading}
              className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-500 disabled:opacity-40 rounded-lg transition-colors"
            >
              {loading ? "Drafting…" : "Draft with AI"}
            </button>
          </div>
          {selectedTicket && (
            <div className="bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-sm text-zinc-400">
              <p className="font-medium text-zinc-300 mb-1">{selectedTicket.subject}</p>
              <p className="text-xs">{selectedTicket.message}</p>
            </div>
          )}
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Select a ticket, then click Draft with AI…"
            rows={10}
            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
          />
        </section>
      </div>
    </main>
  );
}
`,
    );

    file(
      'src/app/api/chat/route.ts',
      `import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: Request) {
  const { ticket } = await req.json();

  const stream = await client.messages.stream({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    system:
      "You are a friendly and empathetic customer support agent. Write clear, helpful, and concise replies to customer support tickets. Acknowledge the customer's concern, provide a solution or next step, and close warmly. Always maintain a professional yet approachable tone.",
    messages: [
      {
        role: "user",
        content: \`Draft a reply to this customer support ticket:\\n\\nSubject: \${ticket.subject}\\n\\nMessage: \${ticket.message}\`,
      },
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
`,
    );

    file(
      'src/components/TicketList.tsx',
      `"use client";

export interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: "open" | "pending" | "resolved";
  from: string;
}

const SAMPLE_TICKETS: Ticket[] = [
  {
    id: "1001",
    subject: "Can't log in to my account",
    message: "Hi, I've been trying to log in for the past hour and keep getting an 'invalid password' error even after resetting. Please help!",
    status: "open",
    from: "alex.kim@example.com",
  },
  {
    id: "1002",
    subject: "Billing charge I don't recognize",
    message: "There's a $49 charge on my card from last Tuesday that I don't recognize. Can you look into this?",
    status: "open",
    from: "maria.santos@example.com",
  },
  {
    id: "1003",
    subject: "Feature request: dark mode",
    message: "Love the product! Any chance you could add a dark mode? My eyes would thank you.",
    status: "pending",
    from: "dev.null@example.com",
  },
  {
    id: "1004",
    subject: "Export to CSV not working",
    message: "When I click 'Export CSV' nothing happens. I'm on Chrome 124 on macOS. Is this a known bug?",
    status: "open",
    from: "jo.patel@example.com",
  },
];

const STATUS_COLORS: Record<Ticket["status"], string> = {
  open: "text-red-400 bg-red-400/10",
  pending: "text-yellow-400 bg-yellow-400/10",
  resolved: "text-green-400 bg-green-400/10",
};

interface Props {
  onSelect: (ticket: Ticket) => void;
  selected: Ticket | null;
}

export function TicketList({ onSelect, selected }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {SAMPLE_TICKETS.map((ticket) => {
        const isSelected = selected?.id === ticket.id;
        return (
          <button
            key={ticket.id}
            onClick={() => onSelect(ticket)}
            className={\`text-left p-3 rounded-xl border transition-colors \${
              isSelected
                ? "border-green-500/40 bg-green-600/10"
                : "border-white/10 bg-zinc-900 hover:bg-zinc-800/80"
            }\`}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-sm font-medium text-zinc-100 leading-snug">{ticket.subject}</span>
              <span className={\`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 \${STATUS_COLORS[ticket.status]}\`}>
                {ticket.status}
              </span>
            </div>
            <p className="text-xs text-zinc-500 line-clamp-1">{ticket.message}</p>
            <p className="text-xs text-zinc-600 mt-1">#{ticket.id} · {ticket.from}</p>
          </button>
        );
      })}
    </div>
  );
}
`,
    );

    if (process.env.AM_SKIP_TEMPLATE_INSTALL !== '1') {
      const install = spawnSync('bun', ['install'], { cwd: dest, stdio: 'inherit' });
      if (install.status !== 0) {
        process.stderr.write('warning: bun install failed — run it manually\n');
      }
    }
  },
};
