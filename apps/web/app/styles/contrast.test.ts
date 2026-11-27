import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { css, type Tone, table } from '../ui/classes';

/**
 * WCAG 2.2 AA contrast for every foreground/background pair the interface
 * uses, computed from the real sources: the theme tokens in styles/app.css
 * (shadcn/ui's neutral dark palette plus ours), Tailwind's own colour
 * palette for the tones, and the class names in ui/classes.ts. Touching a
 * token, a tone's classes or Tailwind's palette re-checks everything.
 *
 * Thresholds: 4.5 : 1 for text, 3 : 1 for the borders that identify a
 * control (WCAG 1.4.11). The browser-level audit of real pages is
 * `pnpm audit:contrast` (scripts/audit-contrast.mjs).
 */

const appCss = readFileSync(join(import.meta.dirname, 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const tailwindTheme = readFileSync(createRequire(import.meta.url).resolve('tailwindcss/theme.css'), 'utf8');

/** Custom properties declared inside the first block whose selector matches. */
function declarations(source: string, selector: RegExp): Record<string, string> {
  const match = selector.exec(source);
  if (!match) throw new Error(`No block for ${selector}`);
  const body = source.slice(match.index + match[0].length, source.indexOf('}', match.index));
  return Object.fromEntries(
    [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name = '', value = '']) => [name, value.trim()]),
  );
}

/** Our theme (`:root`) over Tailwind's palette (`--color-*`), as the browser cascades them. */
const vars: Record<string, string> = {
  ...declarations(tailwindTheme, /@theme default\s*\{/),
  ...declarations(appCss, /:root\s*\{/),
};

type Rgba = [number, number, number, number];

function resolve(value: string, depth = 0): string {
  if (depth > 10) throw new Error(`Cyclic variable in ${value}`);
  return value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => {
    const next = vars[name];
    if (next === undefined) throw new Error(`Undefined variable ${name}`);
    return resolve(next, depth + 1);
  });
}

const number = (part: string) => (part.endsWith('%') ? Number.parseFloat(part) / 100 : Number(part));

/** OKLCH (CSS Color 4) to sRGB 0–255. */
function oklch(lightness: number, chroma: number, hue: number): [number, number, number] {
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return linear.map((c) => {
    const v = Math.min(1, Math.max(0, c));
    return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  }) as [number, number, number];
}

function parse(value: string): Rgba {
  const text = resolve(value).trim();
  const short = /^#([0-9a-f]{3})$/i.exec(text)?.[1];
  const hex = short ? [...short].map((c) => c + c).join('') : /^#([0-9a-f]{6})$/i.exec(text)?.[1];
  if (hex) return [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).concat(1) as Rgba;
  const lch = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(text);
  if (lch) {
    const [, l = '0', c = '0', h = '0', alpha] = lch;
    return [...oklch(number(l), number(c), number(h)), alpha === undefined ? 1 : number(alpha)];
  }
  throw new Error(`Cannot parse colour ${value} → ${text}`);
}

/** Composites a translucent colour over an opaque one. */
const over = ([r, g, b, a]: Rgba, [br, bg, bb]: Rgba): Rgba => [
  r * a + br * (1 - a),
  g * a + bg * (1 - a),
  b * a + bb * (1 - a),
  1,
];

function luminance([r, g, b]: Rgba): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** A colour as a layer: a token or palette name, with an optional Tailwind opacity (`blue-500/15`). */
interface Layer {
  colour: string;
  alpha?: number;
}
const token = (name: string): string => (vars[`--${name}`] ? `var(--${name})` : `var(--color-${name})`);
const layer = (spec: string): Layer => {
  const [name = '', opacity] = spec.split('/');
  return { colour: token(name), alpha: opacity === undefined ? 1 : Number(opacity) / 100 };
};
const flatten = (layers: Layer[]): Rgba =>
  layers.reduce<Rgba>((under, { colour, alpha = 1 }) => {
    const [r, g, b, a] = parse(colour);
    return over([r, g, b, a * alpha], under);
  }, parse('var(--background)'));

function ratio(foreground: Layer, background: Layer[]): number {
  const bg = flatten(background);
  const [r, g, b, a] = parse(foreground.colour);
  const fg = over([r, g, b, a * (foreground.alpha ?? 1)], bg);
  const [light = 0, dark = 0] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
}

/** Surfaces text appears on: the page, cards and menus, and a hovered table row. */
const SURFACES: Record<string, Layer[]> = {
  page: [],
  card: [layer('card')],
  'hovered row': [layer('card'), layer('muted/50')],
};

function check(pairs: [name: string, foreground: Layer, background: Layer[]][], minimum: number) {
  const failures = pairs
    .map(([name, fg, bg]) => [name, ratio(fg, bg)] as const)
    .filter(([, value]) => value < minimum)
    .map(([name, value]) => `${name}: ${value} : 1`);
  expect(failures, `below ${minimum} : 1`).toEqual([]);
}

const onSurfaces = (name: string, colour: Layer): [string, Layer, Layer[]][] =>
  Object.entries(SURFACES).map(([surface, bg]) => [`${name} on ${surface}`, colour, bg]);

/** The `bg-*` colour in a class list from ui/classes.ts (hover variants aside). */
function fill(classes: string): Layer | undefined {
  const bg = /(?:^|\s)bg-([a-z]+(?:-[a-z]+)*(?:-\d+)?(?:\/\d+)?)(?=\s|$)/.exec(classes)?.[1];
  return bg ? layer(bg) : undefined;
}

/** The `text-*` and `bg-*` colours in a class list from ui/classes.ts. */
function colours(classes: string): { text: Layer; bg?: Layer } {
  const text = /(?:^|\s)text-([a-z]+(?:-[a-z]+)*(?:-\d+)?(?:\/\d+)?)(?=\s|$)/.exec(classes)?.[1];
  if (!text) throw new Error(`No text colour in "${classes}"`);
  return { text: layer(text), bg: fill(classes) };
}
const TONES = Object.keys(css.toneText) as Tone[];

describe('contrast (dark mode, WCAG AA)', () => {
  it('reads the dark palette', () => {
    expect(resolve('var(--background)')).toBe('oklch(0.145 0 0)');
    expect(ratio(layer('white'), [layer('black')])).toBe(21);
  });

  it('body, muted and link text on every surface', () => {
    check(
      [
        ...onSurfaces('body text', layer('foreground')),
        ...onSurfaces('muted text (hints, meta, table headers, placeholders)', layer('muted-foreground')),
        ...onSurfaces('link', layer('link')),
        ...onSurfaces('hovered link', layer('link-hover')),
      ],
      4.5,
    );
  });

  it('every tone as text, as a fill, as a badge and as an alert', () => {
    check(
      TONES.flatMap((tone): [string, Layer, Layer[]][] => {
        const fill = colours(css.toneFill[tone]);
        const badge = colours(css.badge[tone]);
        const alert = colours(css.alert[tone]);
        return [
          ...onSurfaces(`${tone} text`, colours(css.toneText[tone]).text),
          [`${tone} fill (scoreboard cell)`, fill.text, [layer('card'), ...(fill.bg ? [fill.bg] : [])]],
          [`${tone} badge`, badge.text, [layer('card'), ...(badge.bg ? [badge.bg] : [])]],
          [`${tone} alert`, alert.text, alert.bg ? [alert.bg] : []],
        ];
      }),
      4.5,
    );
  });

  it('buttons, menus, tooltips and the own scoreboard row', () => {
    check(
      [
        ['primary button', layer('primary-foreground'), [layer('primary')]],
        ['primary button, hover', layer('primary-foreground'), [layer('primary/80')]],
        ['secondary (outline) button', layer('foreground'), [layer('input/30')]],
        ['secondary (outline) button, hover', layer('foreground'), [layer('input/50')]],
        ['danger button', layer('destructive'), [layer('destructive/20')]],
        // Our hover (ui/classes.ts), lighter than shadcn's 30 %.
        ['danger button, hover', layer('destructive'), [layer('destructive/25')]],
        ['menu or select item, highlighted', layer('accent-foreground'), [layer('popover'), layer('accent')]],
        ['menu item', layer('popover-foreground'), [layer('popover')]],
        ['tooltip', layer('background'), [layer('foreground')]],
        ['own scoreboard row', layer('foreground'), [layer('card'), fill(table.rowHighlight) ?? layer('card')]],
      ],
      4.5,
    );
  });

  it('control borders and the focus ring stand out from the page (non-text, 3 : 1)', () => {
    check(
      [
        ['input, select and button border', layer('input'), []],
        ['focus ring', layer('ring'), []],
      ],
      3,
    );
  });

  it('every verdict colour on every surface', () => {
    const kinds = Object.keys(vars).filter((name) => name.startsWith('--verdict-'));
    expect(kinds).toHaveLength(7);
    check(
      kinds.flatMap((kind) => onSurfaces(kind, layer(kind.slice(2)))),
      4.5,
    );
  });

  it('every syntax-highlighting colour on the code background', () => {
    const code = declarations(appCss, /\.oj-code\s*\{/);
    const tokens = Object.entries(code).filter(
      ([name]) => name.startsWith('--shiki-') && name !== '--shiki-background',
    );
    expect(tokens.length).toBeGreaterThan(8);
    check(
      tokens.map(([name, value]): [string, Layer, Layer[]] => [name, { colour: value }, [layer('card')]]),
      4.5,
    );
  });
});
