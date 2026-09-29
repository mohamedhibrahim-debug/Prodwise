import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

/**
 * The button system (see styles/controls.css for the visual contract).
 *
 * - primary: the one main action in a view (cyan). Never more than one.
 * - secondary: bordered neutral action.
 * - ghost: quiet action in toolbars and rows.
 * - subtle: filled neutral, for toggles and chips-with-actions.
 * - destructive: outlined red; `danger` is the solid confirm step.
 * - chrome: for the navy rail and mobile bar.
 *
 * Server components and raw markup use the same look through
 * `buttonAttributes()` or `class="pw-btn" data-variant data-size`.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "subtle" | "destructive" | "danger" | "chrome";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonLook {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  className?: string;
}

/** Props that give any element the button look. Spread onto <button>, <a> or <Link>. */
export function buttonAttributes({ variant = "secondary", size = "md", iconOnly = false, className }: ButtonLook = {}) {
  return {
    className: ["pw-btn", className].filter(Boolean).join(" "),
    "data-variant": variant,
    "data-size": size,
    ...(iconOnly ? { "data-icon-only": "" } : {}),
  } as const;
}

/** Tooltip hook-up for the global tooltip layer (TooltipLayer). */
function tipAttributes(tooltip?: string, shortcut?: string, side?: "top" | "bottom" | "left" | "right") {
  if (!tooltip) return {};
  return { "data-tip": tooltip, ...(shortcut ? { "data-tip-kbd": shortcut } : {}), ...(side ? { "data-tip-side": side } : {}) };
}

export function Spinner() {
  return <span className="pw-spinner" aria-hidden="true" />;
}

type Common = ButtonLook & {
  /** Leading icon (16px). Replaced by the spinner while pending. */
  icon?: ReactNode;
  /** Shown by the tooltip layer on hover and focus. Required in practice for icon-only buttons. */
  tooltip?: string;
  /** Displayed as a key cap inside the tooltip, e.g. "[" or "G R". */
  shortcut?: string;
  tooltipSide?: "top" | "bottom" | "left" | "right";
};

interface ButtonProps extends Common, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  /** Shows a spinner, keeps the label, disables the control and sets aria-busy. */
  pending?: boolean;
}

export function Button({
  variant = "secondary", size = "md", iconOnly = false, className, icon, tooltip, shortcut, tooltipSide,
  pending = false, disabled, children, type = "button", ...rest
}: ButtonProps) {
  return <button
    type={type}
    {...buttonAttributes({ variant, size, iconOnly, className })}
    {...tipAttributes(tooltip, shortcut, tooltipSide)}
    disabled={disabled || pending}
    aria-busy={pending || undefined}
    {...rest}
  >
    {pending ? <Spinner /> : icon}
    {iconOnly ? null : children}
  </button>;
}

interface ButtonLinkProps extends Common, Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "href"> {
  href: string;
  prefetch?: boolean;
}

export function ButtonLink({
  href, variant = "secondary", size = "md", iconOnly = false, className, icon, tooltip, shortcut, tooltipSide, prefetch, children, ...rest
}: ButtonLinkProps) {
  return <Link href={href} prefetch={prefetch} {...buttonAttributes({ variant, size, iconOnly, className })} {...tipAttributes(tooltip, shortcut, tooltipSide)} {...rest}>
    {icon}
    {iconOnly ? null : children}
  </Link>;
}
