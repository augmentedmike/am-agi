import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { ProjectTemplateAdapter } from '../index';
import type { TemplateSpec } from '../spec';

const spec: TemplateSpec = {
  type: 'sales-outbound',
  displayName: 'Sales Outbound',
  description: 'AI-assisted outbound sales — lead management + Claude email drafting',
  pipeline: {
    columns: [
      { id: 'lead', label: 'Lead' },
      { id: 'contacted', label: 'Contacted' },
      { id: 'qualified', label: 'Qualified' },
      { id: 'proposal', label: 'Proposal' },
      { id: 'negotiating', label: 'Negotiating' },
      { id: 'won', label: 'Won' },
      { id: 'lost', label: 'Lost' },
    ],
    transitions: [
      { from: 'lead', to: 'contacted', gates: [] },
      { from: 'contacted', to: 'qualified', gates: [] },
      { from: 'qualified', to: 'proposal', gates: [] },
      { from: 'proposal', to: 'negotiating', gates: [] },
      { from: 'negotiating', to: 'won', gates: [] },
      { from: 'negotiating', to: 'lost', gates: [] },
    ],
  },
  cardTypes: [{ id: 'lead', label: 'Lead', fields: [
    { id: 'email', label: 'Email', type: 'text' as const },
    { id: 'company', label: 'Company', type: 'text' as const },
    { id: 'title', label: 'Title', type: 'text' as const },
    { id: 'source', label: 'Source', type: 'text' as const },
  ] }],
  fields: [],
};

export const salesOutboundAdapter: ProjectTemplateAdapter = {
  type: 'sales-outbound',
  displayName: 'Sales Outbound',
  description: 'AI-assisted outbound sales — lead management + Claude email drafting',
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
  description: "AI-assisted outbound sales",
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
import { LeadTable } from "@/components/LeadTable";

export default function Home() {
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);

  async function draftEmail() {
    if (!selectedLead) return;
    setLoading(true);
    setDraft("");
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead: selectedLead }),
    });
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) { setLoading(false); return; }
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      setDraft((prev) => prev + decoder.decode(value));
    }
    setLoading(false);
  }

  return (
    <main className="max-w-4xl mx-auto p-8 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">${name}</h1>
        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full">Sales Outbound</span>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Leads</h2>
        <LeadTable onSelect={setSelectedLead} selected={selectedLead} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Outreach Draft</h2>
          <button
            onClick={draftEmail}
            disabled={!selectedLead || loading}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg transition-colors"
          >
            {loading ? "Drafting…" : "Draft Email with AI"}
          </button>
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Select a lead above, then click Draft Email with AI…"
          rows={10}
          className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </section>
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
  const { lead } = await req.json();

  const stream = await client.messages.stream({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    system:
      "You are an expert outbound sales copywriter. Write personalized, concise cold outreach emails that are friendly, value-focused, and end with a clear call-to-action. Never use generic templates — make every email feel handcrafted.",
    messages: [
      {
        role: "user",
        content: \`Draft a cold outreach email for this lead: \${lead}\`,
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
      'src/components/LeadTable.tsx',
      `"use client";

const SAMPLE_LEADS = [
  { name: "Priya Sharma", company: "Acme Corp", title: "VP of Engineering", email: "priya@acme.example" },
  { name: "James Okafor", company: "Buildly", title: "CTO", email: "james@buildly.example" },
  { name: "Sofia Reyes", company: "Stackwise", title: "Head of Product", email: "sofia@stackwise.example" },
  { name: "Chen Wei", company: "DataFlow", title: "Director of Operations", email: "chen@dataflow.example" },
];

interface Props {
  onSelect: (lead: string) => void;
  selected: string | null;
}

export function LeadTable({ onSelect, selected }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-900 border-b border-white/10">
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Name</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Company</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Title</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Email</th>
          </tr>
        </thead>
        <tbody>
          {SAMPLE_LEADS.map((lead) => {
            const key = \`\${lead.name} at \${lead.company} (\${lead.title})\`;
            const isSelected = selected === key;
            return (
              <tr
                key={lead.email}
                onClick={() => onSelect(key)}
                className={\`cursor-pointer border-b border-white/5 transition-colors \${isSelected ? "bg-blue-600/20" : "hover:bg-zinc-800/60"}\`}
              >
                <td className="px-4 py-3 font-medium text-zinc-100">{lead.name}</td>
                <td className="px-4 py-3 text-zinc-300">{lead.company}</td>
                <td className="px-4 py-3 text-zinc-400">{lead.title}</td>
                <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{lead.email}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
`,
    );

    const install = spawnSync('bun', ['install'], { cwd: dest, stdio: 'inherit' });
    if (install.status !== 0) {
      process.stderr.write('warning: bun install failed — run it manually\n');
    }
  },
};
