import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { ProjectTemplateAdapter } from '../index';

export const contentMarketingAdapter: ProjectTemplateAdapter = {
  type: 'content-marketing',
  description: 'AI-assisted content marketing — content calendar + Claude post generation',
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
  description: "AI-assisted content marketing",
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
import { ContentCalendar, type ContentItem } from "@/components/ContentCalendar";

export default function Home() {
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [generated, setGenerated] = useState("");
  const [loading, setLoading] = useState(false);

  async function generateContent() {
    if (!selectedItem) return;
    setLoading(true);
    setGenerated("");
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: selectedItem }),
    });
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) { setLoading(false); return; }
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      setGenerated((prev) => prev + decoder.decode(value));
    }
    setLoading(false);
  }

  return (
    <main className="max-w-5xl mx-auto p-8 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">${name}</h1>
        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full">Content Marketing</span>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Content Calendar</h2>
        <ContentCalendar onSelect={setSelectedItem} selected={selectedItem} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
            {selectedItem ? selectedItem.title : "Generated Content"}
          </h2>
          <button
            onClick={generateContent}
            disabled={!selectedItem || loading}
            className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-lg transition-colors"
          >
            {loading ? "Generating…" : "Generate with AI"}
          </button>
        </div>
        <textarea
          value={generated}
          onChange={(e) => setGenerated(e.target.value)}
          placeholder="Select a content item above, then click Generate with AI…"
          rows={14}
          className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
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
  const { item } = await req.json();

  const typeInstructions: Record<string, string> = {
    blog: "Write a full-length blog post with an engaging headline, intro, 3-4 sections with subheadings, and a conclusion with a CTA.",
    linkedin: "Write a LinkedIn post that is insightful, conversational, and ends with a question to drive engagement. Keep it under 300 words.",
    tweet: "Write a tweet thread (3-5 tweets) that is punchy, specific, and uses whitespace well. Number each tweet.",
    newsletter: "Write a newsletter section with a brief intro, key insight, and a takeaway. Friendly and conversational tone.",
  };

  const instructions = typeInstructions[item.type] ?? "Write engaging marketing content.";

  const stream = await client.messages.stream({
    model: "claude-opus-4-5",
    max_tokens: 2048,
    system:
      \`You are an expert content marketer and copywriter. \${instructions} Always write in a clear, human voice that builds trust and authority.\`,
    messages: [
      {
        role: "user",
        content: \`Create content for this item:\\n\\nTitle: \${item.title}\\nType: \${item.type}\\nTopic: \${item.topic}\`,
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
      'src/components/ContentCalendar.tsx',
      `"use client";

export interface ContentItem {
  id: string;
  title: string;
  type: "blog" | "linkedin" | "tweet" | "newsletter";
  topic: string;
  scheduledDate: string;
  status: "planned" | "in-progress" | "published";
}

const SAMPLE_ITEMS: ContentItem[] = [
  {
    id: "c1",
    title: "5 Ways AI Is Changing Content Marketing",
    type: "blog",
    topic: "AI tools for marketers, productivity, content strategy",
    scheduledDate: "Apr 2",
    status: "planned",
  },
  {
    id: "c2",
    title: "The counterintuitive truth about consistency",
    type: "linkedin",
    topic: "Consistency beats perfection in content creation",
    scheduledDate: "Apr 4",
    status: "planned",
  },
  {
    id: "c3",
    title: "Thread: How to repurpose one blog into 10 assets",
    type: "tweet",
    topic: "Content repurposing strategy for small teams",
    scheduledDate: "Apr 7",
    status: "in-progress",
  },
  {
    id: "c4",
    title: "April Newsletter — What we learned this month",
    type: "newsletter",
    topic: "Monthly insights, product updates, and reader Q&A",
    scheduledDate: "Apr 30",
    status: "planned",
  },
];

const TYPE_COLORS: Record<ContentItem["type"], string> = {
  blog: "text-blue-400 bg-blue-400/10",
  linkedin: "text-sky-400 bg-sky-400/10",
  tweet: "text-cyan-400 bg-cyan-400/10",
  newsletter: "text-purple-400 bg-purple-400/10",
};

const STATUS_COLORS: Record<ContentItem["status"], string> = {
  planned: "text-zinc-400 bg-zinc-400/10",
  "in-progress": "text-yellow-400 bg-yellow-400/10",
  published: "text-green-400 bg-green-400/10",
};

interface Props {
  onSelect: (item: ContentItem) => void;
  selected: ContentItem | null;
}

export function ContentCalendar({ onSelect, selected }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {SAMPLE_ITEMS.map((item) => {
        const isSelected = selected?.id === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className={\`text-left p-4 rounded-xl border transition-colors \${
              isSelected
                ? "border-purple-500/40 bg-purple-600/10"
                : "border-white/10 bg-zinc-900 hover:bg-zinc-800/80"
            }\`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className={\`text-xs px-1.5 py-0.5 rounded font-medium \${TYPE_COLORS[item.type]}\`}>
                {item.type}
              </span>
              <span className={\`text-xs px-1.5 py-0.5 rounded font-medium \${STATUS_COLORS[item.status]}\`}>
                {item.status}
              </span>
            </div>
            <p className="text-sm font-medium text-zinc-100 leading-snug mb-1">{item.title}</p>
            <p className="text-xs text-zinc-500">{item.scheduledDate}</p>
          </button>
        );
      })}
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
