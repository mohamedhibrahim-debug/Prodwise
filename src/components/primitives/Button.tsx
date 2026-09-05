import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "ghost";

function classes(variant: Variant, size: "md" | "lg", extra?: string) {
  return [styles.base, styles[variant], size === "lg" ? styles.lg : "", extra]
    .filter(Boolean)
    .join(" ");
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "md" | "lg";
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: ButtonProps) {
  return <button className={classes(variant, size, className)} {...rest} />;
}

interface ButtonLinkProps {
  href: string;
  variant?: Variant;
  size?: "md" | "lg";
  className?: string;
  children: ReactNode;
}

export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
}: ButtonLinkProps) {
  return (
    <Link href={href} className={classes(variant, size, className)}>
      {children}
    </Link>
  );
}
