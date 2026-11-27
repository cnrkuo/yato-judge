/**
 * Interactive overlays, built on Base UI. Base UI handles focus, keyboard and
 * screen-reader behaviour; these wrappers give them Bootstrap's look (its
 * dropdown, modal and nav-tabs classes — Bootstrap's own JavaScript is not
 * loaded) and trim the API down to what the app uses.
 *
 * Rule of thumb: controls inside a <form> that must work without JavaScript
 * stay native; these are for toolbars and one-click actions.
 */
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Menu as BaseMenu } from '@base-ui/react/menu';
import { Select } from '@base-ui/react/select';
import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { Tooltip } from '@base-ui/react/tooltip';
import { type ReactElement, type ReactNode, useId, useState } from 'react';
import { overlay as css, css as kit } from './classes';

// ---------------------------------------------------------------- tooltip

/** Shares the hover delay between tooltips: once one is open, the next opens at once. */
export function TooltipProvider({ delay, children }: { delay: number; children: ReactNode }) {
  return (
    <Tooltip.Provider delay={delay} timeout={300}>
      {children}
    </Tooltip.Provider>
  );
}

/**
 * Explains a terse label (verdict codes, icons) on hover or focus.
 * `children` is the one element it explains. Screen readers hear the
 * explanation as that element's description while it shows.
 */
export function Tip({ label, children }: { label: ReactNode; children: ReactElement }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <Tooltip.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Trigger render={children} aria-describedby={open ? id : undefined} />
      <Tooltip.Portal>
        <Tooltip.Positioner className={css.tooltipLayer} sideOffset={6}>
          <Tooltip.Popup id={id} role="tooltip" className={css.tooltip}>
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
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
    <BaseMenu.Root>
      <BaseMenu.Trigger className={kit.button({ variant: 'secondary', size: 'sm' })}>
        {label} <span aria-hidden>▾</span>
      </BaseMenu.Trigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner className={css.popLayer} align={align} sideOffset={6}>
          <BaseMenu.Popup className={css.menu}>
            {/* A group, so a <MenuLabel> names the entries under it. */}
            <BaseMenu.Group>{children}</BaseMenu.Group>
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <BaseMenu.GroupLabel className={css.menuLabel}>{children}</BaseMenu.GroupLabel>;
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
    <BaseMenu.Item className={`${css.menuItem} ${danger ? css.menuItemDanger : ''}`} onClick={onSelect}>
      {children}
    </BaseMenu.Item>
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
    <BaseMenu.CheckboxItem
      className={css.menuItem}
      checked={checked}
      onCheckedChange={(next) => onChange(next)}
      closeOnClick={false}>
      <span className={css.menuIndicator}>
        <BaseMenu.CheckboxItemIndicator>✓</BaseMenu.CheckboxItemIndicator>
      </span>
      {children}
    </BaseMenu.CheckboxItem>
  );
}

// ----------------------------------------------------------------- select

export interface Option<T extends string> {
  value: T;
  label: ReactNode;
}

/**
 * Picks one of a few options in a toolbar. Callers use a named "all" value
 * rather than an empty string, so every option reads as a choice.
 */
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
    <Select.Root
      items={options}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next);
      }}>
      <Select.Trigger className={`${css.selectTrigger} ${size === 'sm' ? css.selectSmall : ''}`} aria-label={label}>
        <Select.Value />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className={css.popLayer} align="start" sideOffset={6} alignItemWithTrigger={false}>
          <Select.Popup className={css.selectContent}>
            {options.map((option) => (
              <Select.Item key={option.value} value={option.value} className={css.menuItem}>
                <span className={css.menuIndicator}>
                  <Select.ItemIndicator>✓</Select.ItemIndicator>
                </span>
                <Select.ItemText>{option.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
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
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger render={trigger} />
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={css.dialogOverlay} />
        <AlertDialog.Popup className={css.dialog}>
          <div className={css.dialogBody}>
            <AlertDialog.Title className={css.dialogTitle}>{title}</AlertDialog.Title>
            <AlertDialog.Description render={<div />}>{children}</AlertDialog.Description>
            <div className={css.dialogActions}>
              <AlertDialog.Close className={kit.button({ variant: 'secondary' })}>Cancel</AlertDialog.Close>
              <AlertDialog.Close className={kit.button({ variant: 'danger' })} onClick={onConfirm}>
                {confirmLabel}
              </AlertDialog.Close>
            </div>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

// ------------------------------------------------------------------- tabs

/** Switches between views of the same subject inside one card. */
export function Tabs({ tabs }: { tabs: { id: string; label: ReactNode; content: ReactNode }[] }) {
  return (
    <BaseTabs.Root defaultValue={tabs[0]?.id}>
      <div className={css.tabListWrap}>
        {/* Arrow keys switch tabs as they move focus, as before. */}
        <BaseTabs.List className={css.tabList} activateOnFocus>
          {tabs.map((tab) => (
            <BaseTabs.Tab key={tab.id} value={tab.id} className={css.tab}>
              {tab.label}
            </BaseTabs.Tab>
          ))}
        </BaseTabs.List>
      </div>
      {tabs.map((tab) => (
        <BaseTabs.Panel key={tab.id} value={tab.id}>
          {tab.content}
        </BaseTabs.Panel>
      ))}
    </BaseTabs.Root>
  );
}
