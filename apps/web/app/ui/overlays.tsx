/**
 * Interactive overlays: shadcn/ui's components on Base UI, which handles
 * focus, keyboard and screen-reader behaviour. These wrappers trim the API
 * down to what the app uses.
 *
 * Rule of thumb: controls inside a <form> that must work without JavaScript
 * stay native; these are for toolbars and one-click actions.
 */
import { ChevronDownIcon } from 'lucide-react';
import { isValidElement, type ReactElement, type ReactNode, useState } from 'react';
import { overlay as css, css as kit } from './classes';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './shadcn/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from './shadcn/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './shadcn/select';
import { TabsContent, TabsList, Tabs as TabsRoot, TabsTrigger } from './shadcn/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from './shadcn/tooltip';

// ---------------------------------------------------------------- tooltip

export { TooltipProvider } from './shadcn/tooltip';

/** Explains a terse label (verdict codes, icons) on hover or focus. */
export function Tip({ label, children }: { label: ReactNode; children: ReactNode }) {
  // The trigger is the child itself (a span, a link), not an extra button.
  const trigger = isValidElement(children) ? (children as ReactElement) : <span>{children}</span>;
  return (
    <Tooltip>
      <TooltipTrigger render={trigger} />
      <TooltipContent sideOffset={6}>{label}</TooltipContent>
    </Tooltip>
  );
}

// ------------------------------------------------------------------- menu

export function Menu({
  label,
  children,
  align = 'end',
}: {
  label: ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={kit.button({ variant: 'secondary', size: 'sm' })}>
        {label} <ChevronDownIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} sideOffset={6}>
        <DropdownMenuGroup>{children}</DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <DropdownMenuLabel className={css.menuLabel}>{children}</DropdownMenuLabel>;
}

export function MenuItem({
  children,
  onSelect,
  danger = false,
}: {
  children: ReactNode;
  onSelect: () => void;
  danger?: boolean;
}) {
  return (
    <DropdownMenuItem variant={danger ? 'destructive' : 'default'} onClick={onSelect}>
      {children}
    </DropdownMenuItem>
  );
}

/** A menu entry that toggles; the menu stays open so several can be flipped. */
export function MenuCheck({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <DropdownMenuCheckboxItem checked={checked} onCheckedChange={onChange} closeOnClick={false}>
      {children}
    </DropdownMenuCheckboxItem>
  );
}

// ----------------------------------------------------------------- select

export interface Option<T extends string> {
  value: T;
  label: ReactNode;
}

/** Picks one of a few options in a toolbar. */
export function SelectBox<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
}: {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  /** Accessible name; the visible label is the caller's `<Field>`. */
  label: string;
  size?: 'md' | 'sm';
}) {
  return (
    <Select items={options} value={value} onValueChange={(next) => next !== null && onChange(next as T)}>
      <SelectTrigger size={size === 'sm' ? 'sm' : 'default'} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} sideOffset={6}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ----------------------------------------------------------------- dialog

/**
 * Asks before something irreversible happens. `trigger` is the button the
 * user sees; `onConfirm` runs only after they agree.
 */
export function Confirm({
  trigger,
  title,
  children,
  confirmLabel,
  onConfirm,
}: {
  trigger: ReactElement;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription render={<div className={css.dialogBody} />}>{children}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <button
            type="button"
            className={kit.button({ variant: 'danger' })}
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}>
            {confirmLabel}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ------------------------------------------------------------------- tabs

/** Switches between views of the same subject inside one card. */
export function Tabs({ tabs }: { tabs: { id: string; label: ReactNode; content: ReactNode }[] }) {
  return (
    <TabsRoot defaultValue={tabs[0]?.id} className={css.tabs}>
      <div className={css.tabBar}>
        <TabsList variant="line">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id}>
          {tab.content}
        </TabsContent>
      ))}
    </TabsRoot>
  );
}
