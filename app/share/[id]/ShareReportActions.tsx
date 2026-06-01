"use client";

import { useMemo, useState } from "react";

type ShareReportActionsProps = {
  companyName: string;
  reportId: string;
};

export function ShareReportActions({ companyName, reportId }: ShareReportActionsProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return `/share/${reportId}`;
    return `${window.location.origin}/share/${reportId}`;
  }, [reportId]);
  const subject = `AI visibility audit for ${companyName}`;
  const body = `Here is the AI visibility audit for ${companyName}:\n\n${shareUrl}`;

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function openEmailDraft() {
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="share-actions no-print">
      <button type="button" onClick={copyLink}>{copied ? "Copied" : "Copy share link"}</button>
      <button type="button" onClick={openEmailDraft}>Open Gmail draft</button>
      <button type="button" onClick={() => window.print()}>Download PDF / Print</button>
    </div>
  );
}
