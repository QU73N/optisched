"use client";
import { cn } from "@/lib/utils";
import React, { type ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
  disabled?: boolean;
}

/**
 * Aurora background — brand-aligned.
 * Uses OptiSched brand palette (Deep Navy, Core, Bright, Ice) instead of
 * the original blue/indigo/violet stack. Palette driven by CSS variables
 * (--brand-navy, --brand-core, --brand-bright, --brand-ice) set by the
 * Tailwind config's base plugin. See docs/BRAND_SYSTEM.md.
 */
export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  disabled = false,
  ...props
}: AuroraBackgroundProps) => {
  return (
    <div
      className={cn(
        "relative overflow-hidden transition-bg",
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div
          className={cn(
            `
          [--white-gradient:repeating-linear-gradient(100deg,var(--white)_0%,var(--white)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--white)_16%)]
          [--dark-gradient:repeating-linear-gradient(100deg,var(--black)_0%,var(--black)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--black)_16%)]
          [--aurora:repeating-linear-gradient(100deg,var(--brand-core)_10%,var(--brand-bright)_15%,var(--brand-ice)_20%,var(--brand-navy)_25%,var(--brand-bright)_30%)]
          [background-image:var(--white-gradient),var(--aurora)]
          dark:[background-image:var(--dark-gradient),var(--aurora)]
          [background-size:300%,_200%]
          [background-position:50%_50%,50%_50%]
          filter blur-[10px] invert dark:invert-0
          after:content-[""] after:absolute after:inset-0 after:[background-image:var(--white-gradient),var(--aurora)]
          after:dark:[background-image:var(--dark-gradient),var(--aurora)]
          after:[background-size:200%,_100%]
          after:[background-attachment:fixed] after:mix-blend-difference
          pointer-events-none
          absolute -inset-[10px] opacity-40 will-change-transform`,
            !disabled && 'after:animate-aurora',
            showRadialGradient && '[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,var(--transparent)_70%)]'
          )}
        ></div>
      </div>
      {children}
    </div>
  );
};
