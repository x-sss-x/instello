"use client";

import { SpinnerGapIcon } from "@phosphor-icons/react";

export function SpinnerPage() {
  return (
    <div className="flex h-svh w-full items-center justify-center">
      <SpinnerGapIcon
        className="text-muted-foreground size-8 animate-spin"
        weight={"thin"}
      />
    </div>
  );
}
