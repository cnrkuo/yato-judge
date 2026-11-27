/**
 * Every class name the interface uses, in one place. Styling is Tailwind CSS
 * with shadcn/ui's theme (Lyra style, neutral, dark only); the shadcn
 * components themselves live in `ui/shadcn`, and the few `oj-*` rules in
 * `styles/app.css` cover markup the app does not write (code, Markdown).
 *
 * Components in `ui/` read from here, and pages only use those components,
 * so a visual decision (say, how a secondary button looks) is made once.
 *
 * Tailwind generates only the classes it finds spelled out in the source:
 * every name below is written in full, never assembled from pieces.
 */
import { cn } from 'cn';
import { buttonVariants } from './shadcn/button';

export type Tone = 'neutral' | 'primary' | 'success' | 'danger' | 'warning' | 'info';

/** Kinds of verdict; each has its own colour (see `--verdict-*` in app.css). */
export type VerdictKind = 'accepted' | 'wrong' | 'limit' | 'runtime' | 'compile' | 'restricted' | 'neutral';
export const VERDICT_KINDS: readonly VerdictKind[] = [
  'accepted',
  'wrong',
  'limit',
  'runtime',
  'compile',
  'restricted',
  'neutral',
];

type Gap = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
const gapClass: Record<Gap, string> = { xs: 'gap-1', sm: 'gap-2', md: 'gap-4', lg: 'gap-6', xl: 'gap-12' };
const alignClass = { start: 'items-start', center: 'items-center', end: 'items-end' } as const;
const justifyClass = { start: 'justify-start', between: 'justify-between', end: 'justify-end' } as const;

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'link';
/** The kit's button names on shadcn's variants. */
const shadcnVariant = {
  primary: 'default',
  secondary: 'outline',
  danger: 'destructive',
  link: 'link',
} as const satisfies Record<ButtonVariant, string>;

export const css = {
  /** Bootstrap's container widths, kept so pages stay as wide as they were. */
  container: 'mx-auto w-full px-4 xl:max-w-[1140px] 2xl:max-w-[1320px]',

  // ---- layout
  stack: ({ gap = 'md' }: { gap?: Gap } = {}) => `flex min-w-0 flex-col ${gapClass[gap]}`,
  cluster: ({
    gap = 'sm',
    align = 'center',
    justify = 'start',
  }: {
    gap?: Gap;
    align?: 'start' | 'center' | 'end';
    justify?: 'start' | 'between' | 'end';
  } = {}) => `flex min-w-0 flex-wrap ${gapClass[gap]} ${alignClass[align]} ${justifyClass[justify]}`,
  grid: ({ columns = 2 }: { columns?: 2 | 3 | 'tiles' } = {}) =>
    ({
      2: 'grid grid-cols-1 gap-4 md:grid-cols-2',
      3: 'grid grid-cols-1 gap-4 md:grid-cols-3',
      tiles: 'grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-4',
    })[columns],
  split: ({ aside = 'narrow' }: { aside?: 'narrow' | 'wide' | 'half' } = {}) =>
    ({
      narrow: 'grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]',
      wide: 'grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]',
      half: 'grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]',
    })[aside],
  measure: { form: 'mx-auto w-full max-w-[24rem]', page: 'mx-auto w-full max-w-[50rem]' },

  // ---- buttons
  button: ({
    variant = 'primary',
    size = 'md',
    block = false,
  }: {
    variant?: ButtonVariant;
    size?: 'md' | 'sm';
    block?: boolean;
  } = {}) =>
    cn(
      buttonVariants({ variant: shadcnVariant[variant], size: size === 'sm' ? 'sm' : 'default' }),
      // As a <Link>, a secondary button keeps the text colour, not the link's.
      variant === 'secondary' && 'text-foreground hover:text-foreground',
      // shadcn's 30 % hover leaves the red text at 4.4 : 1; 25 % keeps it above 4.5 : 1.
      variant === 'danger' && 'dark:hover:bg-destructive/25',
      // A link-styled button sits in running text: link colour, no box.
      variant === 'link' && 'h-auto p-0 text-link hover:text-link-hover',
      block && 'w-full',
      'no-underline',
    ),

  // ---- card (see <Card>; the box itself is shadcn's)
  cardHeader: 'flex flex-wrap items-center justify-between gap-2 border-b pb-(--card-spacing)',
  cardTitle: 'text-sm font-medium',
  cardBody: 'px-(--card-spacing)',
  /** A padded part of a flush card. */
  cardSection: 'p-(--card-spacing)',
  cardSectionDivided: 'border-t p-(--card-spacing)',

  // ---- page header
  pageHeader: 'mb-6 flex flex-wrap items-end justify-between gap-4',
  /** A page header beside an image (a profile's avatar), which sets the spacing below. */
  pageHeaderTight: 'mb-2 flex flex-wrap items-end justify-between gap-4',
  /** A bar above the page header that places the page in a larger context (a contest). */
  contextBar: 'mb-6 block',
  pageTitle: 'font-heading text-2xl font-semibold tracking-tight',
  pageMeta: 'mt-1 text-xs text-muted-foreground',

  // ---- forms
  field: 'flex min-w-0 flex-col gap-1.5',
  fieldLabel: 'text-xs font-medium',
  /** A fieldset's legend, sized like a field label. */
  groupLabel: 'mb-1.5 text-xs font-medium',
  fieldHint: 'block text-xs text-muted-foreground',
  /** Textareas keep the height their `rows` give them, instead of growing with the text. */
  textarea: 'field-sizing-fixed',
  /** A full-width native select inside a <Field>. */
  selectWrap: 'w-full',
  check: 'flex items-center gap-2 text-xs',
  checkInput: 'size-3.5 shrink-0 accent-primary',
  checkLabel: '',
  /** Controls that should not stretch (filters, short numbers). */
  /** `auto` fits the content, but never beyond its container (long option labels on a phone). */
  inputWidth: { xs: 'w-24', sm: 'w-40', md: 'w-64', auto: 'w-auto max-w-full' },
  monoInput: 'font-mono',

  // ---- tones
  /** Coloured text only — for values inside tables. */
  toneText: {
    neutral: 'font-semibold text-muted-foreground',
    primary: 'font-semibold text-blue-300',
    success: 'font-semibold text-emerald-300',
    danger: 'font-semibold text-red-300',
    warning: 'font-semibold text-amber-300',
    info: 'font-semibold text-cyan-300',
  } satisfies Record<Tone, string>,
  /** Tinted block or table cell with matching text. */
  toneFill: {
    neutral: 'bg-muted text-foreground',
    primary: 'bg-blue-500/15 text-blue-200',
    success: 'bg-emerald-500/15 text-emerald-200',
    danger: 'bg-red-500/15 text-red-200',
    warning: 'bg-amber-500/15 text-amber-200',
    info: 'bg-cyan-500/15 text-cyan-200',
  } satisfies Record<Tone, string>,
  /** On shadcn's <Alert>. */
  alert: {
    neutral: 'border-border bg-card text-card-foreground',
    primary: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    danger: 'border-red-500/30 bg-red-500/10 text-red-200',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    info: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
  } satisfies Record<Tone, string>,
  /** On shadcn's <Badge variant="outline">. */
  badge: {
    neutral: 'border-border bg-muted text-muted-foreground',
    primary: 'border-blue-500/30 bg-blue-500/15 text-blue-300',
    success: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
    danger: 'border-red-500/30 bg-red-500/15 text-red-300',
    warning: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
    info: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300',
  } satisfies Record<Tone, string>,
  notice: 'p-3',
  /** Verdict text, in its kind's colour. */
  verdictText: {
    accepted: 'font-semibold text-verdict-accepted',
    wrong: 'font-semibold text-verdict-wrong',
    limit: 'font-semibold text-verdict-limit',
    runtime: 'font-semibold text-verdict-runtime',
    compile: 'font-semibold text-verdict-compile',
    restricted: 'font-semibold text-verdict-restricted',
    neutral: 'font-semibold text-verdict-neutral',
  } satisfies Record<VerdictKind, string>,

  // ---- data display
  stat: 'bg-card px-3 py-2 ring-1 ring-foreground/10',
  statLabel: 'text-xs text-muted-foreground',
  statValue: 'text-lg font-semibold tabular-nums',
  empty: 'px-4 py-10 text-center text-xs text-muted-foreground',
  list: 'divide-y divide-border',
  listItem: 'flex items-center gap-4 px-(--card-spacing) py-2.5 text-xs [&_a]:no-underline [&_a:hover]:underline',
  avatar: 'size-16 object-cover ring-1 ring-foreground/10',

  // ---- text helpers
  muted: 'text-muted-foreground',
  small: 'text-xs',
  nowrap: 'whitespace-nowrap',
  /** Shown only from the `md` breakpoint up, and only below it. */
  wideOnly: 'hidden md:inline',
  narrowOnly: 'md:hidden',
  numeric: 'tabular-nums',
  truncate: 'truncate',
  grow: 'min-w-0 flex-1',
  preWrap: 'whitespace-pre-wrap [overflow-wrap:anywhere]',
  srOnly: 'sr-only',
  spinner: 'size-3.5',
};

export const table = {
  /** Body cells wrap (shadcn's keep to one line); headers stay on one. */
  head: 'text-muted-foreground [&_a]:no-underline [&_a:hover]:underline',
  cell: 'whitespace-normal [&_a]:no-underline [&_a:hover]:underline',
  sortButton: 'inline-flex items-center gap-1 hover:text-foreground',
  sortIcon: { idle: 'size-3 opacity-40', active: 'size-3 text-foreground' },
  /** The viewer's own row on a scoreboard. */
  rowHighlight: 'bg-blue-500/10 hover:bg-blue-500/15',
  align: { left: 'text-left', right: 'text-right tabular-nums', center: 'text-center' },
  /** Scoreboard cells: fixed width, two short lines. */
  scoreCell: 'min-w-14 text-center leading-tight',
  scoreCellSub: 'block text-[0.7rem] font-normal',
  /** A scored cell's link to the submission it counts. */
  scoreLink: 'block text-inherit no-underline hover:underline',
  toolbar: 'flex flex-wrap items-end justify-between gap-4 border-b p-3',
  footer: 'flex flex-wrap items-center justify-between gap-4 border-t px-3 py-2 text-xs text-muted-foreground',
  /** Previous / next page: plain links, underlined on hover; at either end, plain text. */
  pager: 'inline-flex flex-wrap items-baseline gap-4',
  pagerLink: 'no-underline hover:underline',
  /** Dims the body while newer data is on its way. */
  stale: 'opacity-50',
};

/** Classes for the shadcn overlays (ui/overlays.tsx) beyond their own. */
export const overlay = {
  menuLabel: 'text-muted-foreground',
  dialogBody: 'text-xs/relaxed text-muted-foreground',
  /** Tabs heading a card: the line-style tab list on the card's top edge. */
  tabs: 'gap-0',
  tabBar: 'border-b px-(--card-spacing) pt-(--card-spacing)',
};

export const code = {
  /** Container of Shiki's output; also referenced by the Markdown pipeline. */
  code: 'oj-code',
  numbered: 'oj-code-numbered',
  /** Long content scrolls inside the block instead of stretching the page. */
  scroll: 'oj-code-scroll',
  /** `<CodeInput>`: the code editor takes the textarea's place, in the same box. */
  editor: 'oj-editor',
  editorReady: 'oj-editor oj-editor-ready',
  editorHost: 'oj-editor-host',
  fileLink: 'mt-1 inline-block cursor-pointer text-xs text-link no-underline hover:text-link-hover hover:underline',
};

export const shell = {
  /** On <html>: shadcn's dark palette, the only one. */
  html: 'dark',
  page: 'flex min-h-svh flex-col',
  header: 'border-b bg-card',
  nav: 'flex flex-wrap items-center gap-x-4 gap-y-1 py-2',
  brand: 'mr-2 text-base font-semibold text-foreground no-underline hover:text-foreground',
  navLinks: 'flex flex-1 flex-wrap items-center gap-x-1',
  navLink: 'px-2 py-1 text-sm text-muted-foreground no-underline hover:text-foreground',
  navLinkActive: 'px-2 py-1 text-sm font-semibold text-foreground no-underline hover:text-foreground',
  navEnd: 'flex flex-wrap items-center gap-1',
  main: 'flex-1 py-6',
  footer: 'border-t py-4 text-center text-xs text-muted-foreground',
  errorPage: 'mx-auto flex w-full max-w-[24rem] flex-col items-center gap-4 px-4 py-16 text-center',
  errorTitle: 'text-2xl font-semibold',
};

export const prose = 'oj-prose';
