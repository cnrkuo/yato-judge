import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { shell } from '../ui/classes';

/**
 * The interface rules, enforced: shadcn/ui (Lyra style, on Base UI) with
 * Tailwind CSS, dark only, composed into the UI kit in app/ui. If one of
 * these fails, the fix is almost never to relax the test: use a UI-kit
 * component, or add the class to ui/classes.ts.
 */

const appDir = join(import.meta.dirname, '..');

function files(dir: string, match: (name: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path, match);
    return match(entry.name) ? [path] : [];
  });
}

const rel = (path: string) => relative(appDir, path);
const read = (path: string) => readFileSync(path, 'utf8');
/** Comments may mention anything; only code is checked. */
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const sources = files(appDir, (name) => /\.tsx?$/.test(name) && !name.endsWith('.test.ts'));
const components = sources.filter((path) => path.endsWith('.tsx'));
/** Everything that is not the UI kit: routes, shared page components, root. */
const pages = components.filter((path) => !rel(path).startsWith('ui/'));
/** The UI kit, without the shadcn components it is built from (ui/shadcn, as the CLI writes them). */
const kit = sources.filter((path) => rel(path).startsWith('ui/') && !rel(path).startsWith('ui/shadcn/'));
const stylesheet = read(join(appDir, 'styles/app.css'));
const manifest = JSON.parse(read(join(appDir, '..', 'package.json'))) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};
const shadcnConfig = JSON.parse(read(join(appDir, '..', 'components.json'))) as {
  style: string;
  iconLibrary: string;
  tailwind: { css: string; baseColor: string };
};

function offenders(paths: string[], pattern: RegExp): string[] {
  return paths.flatMap((path) => {
    const lines = code(read(path)).split('\n');
    return lines.flatMap((line, index) =>
      pattern.test(line) ? [`${rel(path)}:${index + 1}: ${line.trim().slice(0, 80)}`] : [],
    );
  });
}

describe('interface consistency', () => {
  it('has files to check', () => {
    expect(pages.length).toBeGreaterThan(20);
    expect(kit.length).toBeGreaterThan(4);
  });

  it('styles with shadcn/ui on Base UI and Tailwind, plus exactly one stylesheet of our own', () => {
    expect(files(appDir, (name) => name.endsWith('.css') || name.endsWith('.css.ts')).map(rel)).toEqual([
      'styles/app.css',
    ]);
    // Preset buFywKu: the Lyra style on Base UI, neutral colours, Lucide icons.
    expect(shadcnConfig).toMatchObject({
      style: 'base-lyra',
      iconLibrary: 'lucide',
      tailwind: { css: 'app/styles/app.css', baseColor: 'neutral' },
    });
    expect(stylesheet).toMatch(/@import "tailwindcss";/);
    expect(stylesheet).toMatch(/@import "shadcn\/tailwind\.css";/);
    expect(manifest.dependencies['@base-ui/react']).toBeDefined();
    expect(manifest.devDependencies.tailwindcss).toMatch(/^4\./);
    expect(JSON.stringify(manifest)).not.toMatch(/"bootstrap"|radix|react-bootstrap|"@popperjs|vanilla-extract/);
  });

  it('prefixes every class of its own with oj- so it cannot collide with Tailwind or shadcn', () => {
    const rules = stylesheet.replace(/\/\*[\s\S]*?\*\//g, '');
    const own = [...rules.matchAll(/(?:^|[\s,>+~(])\.([a-zA-Z][\w-]*)/gm)].map(([, name = '']) => name);
    // Shadcn's dark-mode hook, and the Shiki and Temml ones that app.css refines.
    const allowed = new Set(['dark', 'line', 'math-display', 'temml-error']);
    expect(own.filter((name) => !name.startsWith('oj-') && !allowed.has(name))).toEqual([]);
  });

  it('is dark mode only', () => {
    expect(shell.html).toBe('dark');
    expect(read(join(appDir, 'root.tsx'))).toMatch(/<html[^>]*className=\{shell\.html\}/);
    expect(stylesheet).toMatch(/:root\s*\{\s*color-scheme:\s*dark;/);
    const everything = [...sources.map(read), stylesheet].map(code).join('\n');
    // No colour-mode switching and no light palette anywhere.
    expect(everything).not.toMatch(
      /prefers-color-scheme|\.light\b|:root:not\(\.dark\)|classList\.(toggle|add|remove)\(['"]dark/,
    );
  });

  it('self-hosts JetBrains Mono, uses the system font rather than Inter, and loads no font from a CDN', () => {
    expect(read(join(appDir, 'root.tsx'))).toMatch(/@fontsource\/jetbrains-mono\//);
    expect(stylesheet).toMatch(/--font-mono:\s*"JetBrains Mono"/);
    expect(stylesheet).toMatch(/--font-sans:\s*system-ui\b/);
    expect(JSON.stringify(manifest)).not.toMatch(/inter\b/i);
    expect(offenders([...sources, join(appDir, 'styles/app.css')], /\bInter\b|fontsource(-variable)?\/inter/)).toEqual(
      [],
    );
    expect(offenders(sources, /fonts\.(googleapis|gstatic)\.com|use\.typekit|fonts\.bunny/)).toEqual([]);
  });

  it('keeps corners square, as the Lyra style does', () => {
    expect(offenders(sources, /\brounded-(?!none\b)[\w[\]-]+/)).toEqual([]);
  });

  it('takes behaviour from Base UI, through the shadcn components: no Bootstrap, no Radix', () => {
    expect(offenders(sources, /from ['"](bootstrap|radix-ui|@radix-ui\/)/)).toEqual([]);
  });

  it('never styles inline', () => {
    expect(offenders(components, /\bstyle=\{/)).toEqual([]);
  });

  it('keeps class names out of pages: they come from the UI kit and ui/classes.ts', () => {
    expect(offenders(pages, /className=["'`]/)).toEqual([]);
  });

  it('spells every class name out in full, as Tailwind only generates the ones it finds', () => {
    // `text-${tone}` would compile to nothing; ui/classes.ts maps each value to a full name instead.
    expect(offenders(kit, /\b[a-z]+(?:-[a-z]+)*-\$\{/)).toEqual([]);
  });

  it('renders every table through DataTable', () => {
    expect(offenders(pages, /<(table|thead|tbody|tr|td|th)[\s>]/)).toEqual([]);
  });

  it('uses the kit and its overlay wrappers instead of Base UI, shadcn or browser dialogs directly', () => {
    expect(offenders(pages, /from ['"](@base-ui\/react[^'"]*|~\/ui\/shadcn\/[^'"]*)['"]|\b(confirm|alert)\(/)).toEqual(
      [],
    );
    expect(offenders(pages, /from ['"]@tanstack\/react-table['"]/)).toEqual([]);
  });
});
