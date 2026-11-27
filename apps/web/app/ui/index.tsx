/**
 * The UI kit. Pages are composed from these components and write no class
 * names of their own. Underneath are shadcn/ui's components (ui/shadcn, on
 * Base UI) and the Tailwind classes in classes.ts.
 */
import { ContestPhase, VERDICT_LABEL, VERDICT_SHORT, Verdict } from '@yato/contract';
import { cn } from 'cn';
import {
  type ButtonHTMLAttributes,
  type ComponentProps,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Link, useRouteLoaderData } from 'react-router';
import { userPath } from '~/lib/params';
import { formatDateTime, formatOffset } from '~/lib/time';
import type { loader as rootLoader } from '~/root';
import { type ButtonVariant, css, type Tone, type VerdictKind } from './classes';
import { Tip } from './overlays';
import { Alert } from './shadcn/alert';
import { Badge as ShadcnBadge } from './shadcn/badge';
import { CardFooter, Card as ShadcnCard } from './shadcn/card';
import { Input } from './shadcn/input';
import { NativeSelect } from './shadcn/native-select';
import { Spinner } from './shadcn/spinner';
import { Textarea } from './shadcn/textarea';

export type { Tone };
export { css };

type Gap = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
interface BoxProps {
  children: ReactNode;
  className?: string;
}

// ----------------------------------------------------------------- layout

/** Children stacked vertically with one consistent gap. */
export function Stack({ gap, children, className }: BoxProps & { gap?: Gap }) {
  return <div className={cn(css.stack({ gap }), className)}>{children}</div>;
}

/** A row of things that wraps: buttons, filters, facts. */
export function Cluster({
  gap,
  align,
  justify,
  children,
  className,
}: BoxProps & { gap?: Gap; align?: 'start' | 'center' | 'end'; justify?: 'start' | 'between' | 'end' }) {
  return <div className={cn(css.cluster({ gap, align, justify }), className)}>{children}</div>;
}

/** Equal columns that collapse to one on small screens. */
export function Grid({ columns, children }: BoxProps & { columns?: 2 | 3 | 'tiles' }) {
  return <div className={css.grid({ columns })}>{children}</div>;
}

/** Main content with a sidebar. Pass exactly two children. */
export function Split({ aside, children }: BoxProps & { aside?: 'narrow' | 'wide' | 'half' }) {
  return <div className={css.split({ aside })}>{children}</div>;
}

/** Narrow centred column: `form` for sign-in sized forms, `page` for editors. */
export function Measure({ size, children }: BoxProps & { size: 'form' | 'page' }) {
  return <div className={css.measure[size]}>{children}</div>;
}

// ------------------------------------------------------------- page, card

/** `tight`: less space below, for a header beside an image (a profile's avatar). */
export function PageHeader({
  title,
  meta,
  actions,
  tight = false,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  tight?: boolean;
}) {
  return (
    <header className={tight ? css.pageHeaderTight : css.pageHeader}>
      <div className={css.grow}>
        <h1 className={css.pageTitle}>{title}</h1>
        {meta && <div className={css.pageMeta}>{meta}</div>}
      </div>
      {actions && <Cluster>{actions}</Cluster>}
    </header>
  );
}

/**
 * shadcn's card. `flush` drops the body padding so a table or list can run
 * edge to edge; use `<CardBody>` inside a flush card for padded parts.
 */
export function Card({
  title,
  actions,
  footer,
  flush = false,
  children,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <ShadcnCard className={flush ? 'gap-0 py-0' : undefined}>
      {(title || actions) && (
        <div className={cn(css.cardHeader, css.cardBody, flush && 'pt-(--card-spacing)')}>
          <h2 className={css.cardTitle}>{title}</h2>
          {actions}
        </div>
      )}
      {flush ? children : <div className={css.cardBody}>{children}</div>}
      {footer && <CardFooter>{footer}</CardFooter>}
    </ShadcnCard>
  );
}

export function CardBody({ children, divided = false }: { children: ReactNode; divided?: boolean }) {
  return <div className={divided ? css.cardSectionDivided : css.cardSection}>{children}</div>;
}

// ---------------------------------------------------------------- buttons

interface ButtonStyle {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  block?: boolean;
}

/**
 * One primary button per view at most; everything else is `secondary`.
 * `busy` shows a spinner and blocks repeated clicks. A native button in
 * shadcn's styles: inside a form it submits it, with or without JavaScript.
 */
export function Button({
  variant,
  size,
  block,
  busy,
  className,
  children,
  ...props
}: ButtonStyle & { busy?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(css.button({ variant, size, block }), className)}
      aria-busy={busy || undefined}
      disabled={props.disabled || busy}>
      {busy && <Spinner className={css.spinner} />}
      {children}
    </button>
  );
}

/** A navigation link that looks like a button. */
export function ButtonLink({
  variant = 'secondary',
  size,
  block,
  ...props
}: ButtonStyle & ComponentProps<typeof Link>) {
  return <Link {...props} role="button" className={css.button({ variant, size, block })} />;
}

// ------------------------------------------------------------------ forms

/**
 * Turns a native form element into shadcn's version of it: <Input>,
 * <Textarea> or <NativeSelect>, all native underneath, so forms work
 * without JavaScript. Checkboxes, radios and hidden inputs stay as they are.
 */
function control(element: ReactNode): ReactNode {
  if (!isValidElement(element) || typeof element.type !== 'string') return element;
  const props = (element as ReactElement<{ className?: string; type?: string }>).props;
  const key = element.key ?? undefined;
  switch (element.type) {
    case 'input':
      if (props.type === 'checkbox' || props.type === 'radio' || props.type === 'hidden') return element;
      return <Input key={key} {...(props as ComponentProps<'input'>)} />;
    case 'textarea':
      return (
        <Textarea key={key} {...(props as ComponentProps<'textarea'>)} className={cn(css.textarea, props.className)} />
      );
    case 'select':
      return (
        <NativeSelect
          key={key}
          {...(props as ComponentProps<typeof NativeSelect>)}
          className={props.className ?? css.selectWrap}
        />
      );
    default:
      return element;
  }
}

/**
 * Label above, control, optional hint below — the only form-row shape.
 * Put a native `<input>`, `<select>` or `<textarea>` inside; it becomes
 * shadcn's styled control automatically.
 */
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is `children`, wrapped by control().
    <label className={css.field}>
      <span className={css.fieldLabel}>{label}</span>
      {control(children)}
      {hint && <span className={css.fieldHint}>{hint}</span>}
    </label>
  );
}

/** A native form control outside a `<Field>` (search boxes, inline selects). */
export function Control({ children }: { children: ReactElement }) {
  return <>{control(children)}</>;
}

/**
 * Several checkboxes (`<CheckField>`s) under one label. A `<Field>` is a
 * `<label>` and holds exactly one control, so a group is a fieldset.
 */
export function CheckGroup({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className={css.field}>
      <legend className={css.groupLabel}>{label}</legend>
      {children}
      {hint && <span className={css.fieldHint}>{hint}</span>}
    </fieldset>
  );
}

/** A native checkbox, so it works in a form without JavaScript. */
export function CheckField({ label, ...props }: { label: ReactNode } & ComponentProps<'input'>) {
  return (
    <label className={css.check}>
      <input type="checkbox" className={css.checkInput} {...props} />
      <span className={css.checkLabel}>{label}</span>
    </label>
  );
}

/** Feedback from an action: an error, or a confirmation. */
export function Notice({ result }: { result?: { ok: boolean; error?: string; message?: string } | null }) {
  if (!result) return null;
  if (!result.ok) {
    return <Alert className={css.alert.danger}>{result.error}</Alert>;
  }
  if (!result.message) return null;
  return (
    <Alert role="status" className={css.alert.success}>
      {result.message}
    </Alert>
  );
}

/** Standing information about the page's state (not the result of an action). */
export function Callout({ tone = 'primary', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <Alert role="status" className={css.alert[tone]}>
      {children}
    </Alert>
  );
}

// ------------------------------------------------------------ data display

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <ShadcnBadge variant="outline" className={css.badge[tone]}>
      {children}
    </ShadcnBadge>
  );
}

/** Every verdict belongs to one kind, and so has one colour, everywhere it appears. */
const VERDICT_KIND: Record<Verdict, VerdictKind> = {
  [Verdict.AC]: 'accepted',
  [Verdict.PE]: 'wrong',
  [Verdict.WA]: 'wrong',
  [Verdict.TLE]: 'limit',
  [Verdict.MLE]: 'limit',
  [Verdict.OLE]: 'limit',
  [Verdict.RE]: 'runtime',
  [Verdict.CE]: 'compile',
  [Verdict.RF]: 'restricted',
  [Verdict.WAIT]: 'neutral',
  [Verdict.JUDGING]: 'neutral',
  [Verdict.JE]: 'neutral',
  [Verdict.SE]: 'neutral',
};

export const verdictKind = (verdict: Verdict): VerdictKind => VERDICT_KIND[verdict];

/**
 * A verdict in its colour: the short code ("MLE") with the name as a
 * tooltip, or with `long` the name ("Memory Limit Exceeded"), which wraps
 * where it does not fit — except on narrow screens, which get the code.
 */
export function VerdictBadge({ verdict, long = false }: { verdict: Verdict; long?: boolean }) {
  const tone = cn(css.verdictText[verdictKind(verdict)], css.nowrap);
  const short = (
    <Tip label={VERDICT_LABEL[verdict]}>
      <span className={long ? cn(tone, css.narrowOnly) : tone}>{VERDICT_SHORT[verdict]}</span>
    </Tip>
  );
  if (!long) return short;
  // The name may wrap: even on a wide screen it can be wider than a tile.
  return (
    <>
      <span className={cn(css.verdictText[verdictKind(verdict)], css.wideOnly)}>{VERDICT_LABEL[verdict]}</span>
      {short}
    </>
  );
}

export function PhaseBadge({ phase }: { phase: ContestPhase }) {
  if (phase === ContestPhase.RUNNING) return <Badge tone="success">Running</Badge>;
  if (phase === ContestPhase.PREPARING) return <Badge tone="primary">Upcoming</Badge>;
  return <Badge>Ended</Badge>;
}

/** A row of headline numbers. */
export function Stats({ items }: { items: [label: string, value: ReactNode][] }) {
  return (
    <Grid columns="tiles">
      {items.map(([label, value]) => (
        <div key={label} className={css.stat}>
          <div className={css.statLabel}>{label}</div>
          <p className={css.statValue}>{value}</p>
        </div>
      ))}
    </Grid>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className={css.empty}>{children}</p>;
}

export function Muted({ children, small = false }: { children: ReactNode; small?: boolean }) {
  return <span className={cn(css.muted, small && css.small)}>{children}</span>;
}

// ------------------------------------------------------------ app helpers

export function useRoot() {
  const data = useRouteLoaderData<typeof rootLoader>('root');
  if (!data) throw new Error('useRoot() is only available below the root route');
  return data;
}

export function UserLink({ user }: { user: { id: number; username: string } }) {
  return <Link to={userPath(user.username)}>{user.username}</Link>;
}

/**
 * Timestamp in the site time zone. The zone and its offset are in the
 * tooltip; `withZone` also prints the offset, for times people plan around
 * (a contest's start and end).
 */
export function Time({ value, withZone = false }: { value: string; withZone?: boolean }) {
  const { timeZone } = useRoot();
  const offset = formatOffset(value, timeZone);
  return (
    <time dateTime={value} title={`${timeZone} (${offset})`} className={cn(css.nowrap, css.numeric)}>
      {formatDateTime(value, timeZone)}
      {withZone && <span className={css.muted}> {offset}</span>}
    </time>
  );
}
