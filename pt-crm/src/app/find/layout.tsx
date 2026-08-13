import { FindChrome } from "@/components/find-chrome";

export default async function FindLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 text-zinc-100">
      <FindChrome />
      {children}
    </div>
  );
}
