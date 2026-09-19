"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

export type ButtonVariant = "primary" | "coral" | "ocean" | "secondary" | "ghost" | "dark";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-gradient text-white shadow-pop hover:brightness-105 disabled:shadow-none",
  coral: "bg-brand-coral text-white shadow-coral hover:bg-brand-coral-deep disabled:shadow-none",
  ocean: "bg-brand-ocean text-white shadow-soft hover:bg-brand-ocean-deep",
  secondary:
    "glass text-ink hover:bg-white/90 hover:shadow-lift",
  ghost: "bg-transparent text-ink-soft hover:bg-white/60 hover:text-ink",
  dark: "bg-ink text-white shadow-soft hover:bg-[#3a3158]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5 rounded-xl",
  md: "h-11 px-5 text-sm gap-2 rounded-2xl",
  lg: "h-13 px-6 text-base gap-2 rounded-2xl",
  xl: "h-16 px-8 text-lg gap-2.5 rounded-3xl",
};

type BaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  children?: ReactNode;
};

type ButtonProps = BaseProps &
  Omit<HTMLMotionProps<"button">, "children" | "className"> &
  Pick<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "disabled" | "form">;

function classes({ variant = "primary", size = "md", className = "" }: BaseProps) {
  return [
    "relative inline-flex select-none items-center justify-center font-bold tracking-tight transition-[background,box-shadow,filter,color] duration-200",
    "focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-violet/60",
    "disabled:cursor-not-allowed disabled:opacity-55",
    VARIANTS[variant],
    SIZES[size],
    className,
  ].join(" ");
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent opacity-80"
    />
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, leading, trailing, className, children, disabled, ...rest },
  ref,
) {
  const reduceMotion = useReducedMotion();
  const isDisabled = disabled || loading;
  return (
    <motion.button
      ref={ref}
      whileHover={reduceMotion || isDisabled ? undefined : { y: -2, scale: 1.02 }}
      whileTap={reduceMotion || isDisabled ? undefined : { scale: 0.97, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
      disabled={isDisabled}
      className={classes({ variant, size, className })}
      {...rest}
    >
      {loading ? <Spinner /> : leading}
      {children}
      {trailing}
    </motion.button>
  );
});

type ButtonLinkProps = BaseProps & {
  href: string;
  prefetch?: boolean;
  external?: boolean;
};

export function ButtonLink({ href, external, prefetch, ...props }: ButtonLinkProps) {
  const reduceMotion = useReducedMotion();
  const cls = classes(props);
  const inner = (
    <>
      {props.leading}
      {props.children}
      {props.trailing}
    </>
  );
  if (external) {
    return (
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        whileHover={reduceMotion ? undefined : { y: -2, scale: 1.02 }}
        whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        className={cls}
      >
        {inner}
      </motion.a>
    );
  }
  return (
    <motion.span
      whileHover={reduceMotion ? undefined : { y: -2, scale: 1.02 }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      className="inline-flex"
    >
      <Link href={href} prefetch={prefetch} className={cls}>
        {inner}
      </Link>
    </motion.span>
  );
}
