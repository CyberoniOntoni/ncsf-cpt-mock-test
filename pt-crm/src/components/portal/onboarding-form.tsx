"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signPortalDocumentAction } from "@/app/actions/portal/documents";
import { SignaturePad } from "@/components/portal/signature-pad";
import { Button } from "@/components/ui";
import { REQUIRED_PORTAL_DOCUMENTS } from "@/lib/portal-documents";

export function OnboardingForm({
  documents,
}: {
  documents: Array<{
    id: string;
    type: string;
    title: string;
    status: string;
    documentVersion: string;
  }>;
}) {
  const router = useRouter();
  const remaining = documents.filter((d) => d.status !== "signed");
  const pendingDoc = remaining[0];
  const signedCount = documents.length - remaining.length;
  const template = REQUIRED_PORTAL_DOCUMENTS.find((d) => d.type === pendingDoc?.type);
  const [sig, setSig] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!pendingDoc) {
    return (
      <p className="text-sm text-zinc-400">
        All documents signed. Taking you to your plan…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {pendingDoc.type.replace(/_/g, " ")} · v{pendingDoc.documentVersion}
          {documents.length > 1
            ? ` · ${signedCount + 1} of ${documents.length}`
            : ""}
        </p>
        <h2 className="mt-1 text-lg font-semibold">{pendingDoc.title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          {template?.body}
        </p>
      </div>
      {pendingDoc.status === "signed" ? (
        <p className="text-sm text-emerald-300">Already signed.</p>
      ) : (
        <>
          <SignaturePad value={sig} onChange={setSig} />
          {error && (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          )}
          <Button
            className="w-full"
            loading={pending}
            disabled={!sig}
            onClick={() => {
              setError(null);
              start(async () => {
                const res = await signPortalDocumentAction({
                  documentId: pendingDoc.id,
                  signatureData: sig,
                });
                if (!res.ok) setError(res.error);
                else if (res.finished) router.push("/portal/dashboard");
                else {
                  setSig("");
                  router.refresh();
                }
              });
            }}
          >
            Agree & sign
          </Button>
        </>
      )}
    </div>
  );
}
