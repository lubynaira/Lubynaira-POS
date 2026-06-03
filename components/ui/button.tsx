import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap border text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:focus-ring",
          {
            "border-accent bg-accent text-white shadow-[0_0_22px_rgb(203_158_54/0.18)] hover:brightness-110": variant === "primary",
            "border-line bg-panel/90 text-ink hover:border-accent/50 hover:bg-accent/10": variant === "secondary",
            "border-transparent bg-transparent text-muted hover:bg-accent/10 hover:text-ink": variant === "ghost",
            "bg-coral text-white border-coral hover:brightness-95": variant === "danger",
            "bg-transparent text-ink border-line hover:border-accent/50 hover:bg-accent/5": variant === "outline",
            "h-9 px-3": size === "sm",
            "h-10 px-4": size === "md",
            "h-10 w-10 p-0": size === "icon"
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
