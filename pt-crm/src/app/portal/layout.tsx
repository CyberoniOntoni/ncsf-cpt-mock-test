import type { ReactNode } from "react";

export const metadata = {
  title: { default: "Client portal" },
};

export default function PortalRootLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100 antialiased">
      {children}
    </div>
  );
}
