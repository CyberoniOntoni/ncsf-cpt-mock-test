"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

export function AuthSubmitButton({
  children,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className={props.className ?? "w-full min-h-11"}
      size="lg"
      loading={pending}
      disabled={pending}
    >
      {pending ? "Please wait…" : children}
    </Button>
  );
}
