import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectTemplateAdapter } from '../index';

export const bunLibAdapter: ProjectTemplateAdapter = {
  type: 'bun-lib',
  description: 'Bun TypeScript library with package.json, tsconfig.json, src/index.ts, and tests',
  scaffold(name: string, dest: string): void {
    mkdirSync(join(dest, 'src'), { recursive: true });

    writeFileSync(
      join(dest, 'package.json'),
      JSON.stringify(
        {
          name,
          version: '0.1.0',
          private: false,
          type: 'module',
          main: './dist/index.js',
          module: './dist/index.js',
          types: './dist/index.d.ts',
          scripts: {
            build: 'bun build ./src/index.ts --outdir ./dist --target bun',
            test: 'bun test',
            typecheck: 'tsc --noEmit',
          },
          devDependencies: {
            typescript: '^5',
            '@types/bun': 'latest',
          },
        },
        null,
        2,
      ) + '\n',
    );

    writeFileSync(
      join(dest, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'bundler',
            lib: ['ES2022'],
            strict: true,
            skipLibCheck: true,
            declaration: true,
            declarationMap: true,
            outDir: './dist',
            rootDir: './src',
          },
          include: ['src'],
          exclude: ['node_modules', 'dist'],
        },
        null,
        2,
      ) + '\n',
    );

    writeFileSync(
      join(dest, 'src', 'index.ts'),
      `/**
 * ${name}
 */

export function hello(name: string): string {
  return \`Hello, \${name}!\`;
}
`,
    );

    writeFileSync(
      join(dest, 'src', 'index.test.ts'),
      `import { describe, it, expect } from 'bun:test';
import { hello } from './index';

describe('hello', () => {
  it('returns a greeting', () => {
    expect(hello('world')).toBe('Hello, world!');
  });
});
`,
    );

    writeFileSync(join(dest, 'README.md'), `# ${name}\n\nA Bun TypeScript library.\n\n## Usage\n\n\`\`\`ts\nimport { hello } from '${name}';\nconsole.log(hello('world'));\n\`\`\`\n`, 'utf8');

    writeFileSync(
      join(dest, '.gitignore'),
      `node_modules/\ndist/\n.env\n*.tsbuildinfo\n`,
      'utf8',
    );
  },
};
