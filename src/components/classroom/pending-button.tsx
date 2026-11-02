"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// for useFormAction forms, useFormStatus doesnt see those
export function PendingButton({
  pending,
  children,
  intent,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "type"> & { pending: boolean; intent?: string }) {
  return (
    <Button {...props} type="submit" name={intent ? "intent" : undefined} value={intent} disabled={pending || props.disabled}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}
