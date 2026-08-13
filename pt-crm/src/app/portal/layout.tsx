import type { ReactNode } from "react";

export default function PortalRootLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100 antialiased">
      {children}
    </div>
  );
}
