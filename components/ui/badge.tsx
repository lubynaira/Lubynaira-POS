import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-1 border border-line bg-accent/10 px-2.5 text-xs font-semibold text-ink",
        className
      )}
      {...props}
    />
  );
}
