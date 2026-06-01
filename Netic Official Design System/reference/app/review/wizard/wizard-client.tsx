"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle } from "lucide-react";
import { CustomerJobTypeTable } from "@/components/review/CustomerJobTypeTable";
import { CustomerExcludedList } from "@/components/review/CustomerExcludedList";
import { CustomerAttentionCards } from "@/components/review/CustomerAttentionCards";

const STEPS = [
  { num: 1, title: "Your Job Types" },
  { num: 2, title: "Excluded Items" },
  { num: 3, title: "Needs Input" },
  { num: 4, title: "Standard Rules" },
  { num: 5, title: "Review & Confirm" },
];

interface WizardClientProps {
  configVersionId: string;
  tenantName: string;
  currentStep: number;
}

interface ConfigSummary {
  total: number;
  matched: number;
  excluded: number;
  noMatch: number;
  customerEdited: number;
  byTrade: Record<string, number>;
}

export function WizardClient({
  configVersionId,
  tenantName,
  currentStep,
}: WizardClientProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [confirmed, setConfirmed] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [summary, setSummary] = useState<ConfigSummary | null>(null);

  useEffect(() => {
    if (currentStep === 5) {
      fetch(`/api/job-types?versionId=${configVersionId}`)
        .then((r) => r.json())
        .then((jobTypes: any[]) => {
          const byTrade: Record<string, number> = {};
          let customerEdited = 0;
          for (const jt of jobTypes) {
            if (jt.matchStatus === "excluded") continue;
            const trade = jt.stTrade || "Other";
            byTrade[trade] = (byTrade[trade] || 0) + 1;
            if (jt.customerEdited) customerEdited++;
          }
          setSummary({
            total: jobTypes.length,
            matched: jobTypes.filter(
              (j: any) =>
                j.matchStatus === "matched" || j.matchStatus === "manual"
            ).length,
            excluded: jobTypes.filter(
              (j: any) => j.matchStatus === "excluded"
            ).length,
            noMatch: jobTypes.filter(
              (j: any) => j.matchStatus === "no_match"
            ).length,
            customerEdited,
            byTrade,
          });
        });
    }
  }, [currentStep, configVersionId]);

  function goToStep(step: number) {
    router.push(`/review/wizard?step=${step}`);
  }

  async function handleConfirm() {
    if (!confirmChecked || !session?.user) return;
    setConfirming(true);

    const res = await fetch(`/api/versions/${configVersionId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmedBy: session.user.email,
        confirmerName: session.user.name,
      }),
    });

    setConfirming(false);

    if (res.ok) {
      setConfirmed(true);
    } else {
      const data = await res.json();
      alert(`Cannot confirm: ${data.error}`);
    }
  }

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center gap-1.5 mb-8 overflow-x-auto">
        {STEPS.map((step, i) => (
          <div key={step.num} className="flex items-center gap-1.5">
            <button
              onClick={() => goToStep(step.num)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                currentStep === step.num
                  ? "bg-primary text-primary-foreground"
                  : currentStep > step.num
                    ? "bg-success/10 text-success"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-[10px]">
                {currentStep > step.num ? "\u2713" : step.num}
              </span>
              <span className="hidden sm:inline">{step.title}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className="w-6 h-px bg-border shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-background border rounded-lg p-6">
        {/* Step 1: Your Job Types */}
        {currentStep === 1 && (
          <div>
            <h3 className="text-lg font-semibold mb-1">Your Job Types</h3>
            <p className="text-sm text-muted-foreground mb-1">
              These are the job types Netic&apos;s AI agent will handle for your
              customers. Review and adjust the settings.
            </p>
            <p className="text-xs text-muted-foreground mb-5 bg-muted/50 px-3 py-2 rounded-md">
              Click a display name or price to edit it. Toggle switches save
              automatically. Hover the{" "}
              <span className="text-muted-foreground/80">?</span> icons for
              explanations.
            </p>
            <CustomerJobTypeTable configVersionId={configVersionId} />
          </div>
        )}

        {/* Step 2: Excluded Items */}
        {currentStep === 2 && (
          <div>
            <h3 className="text-lg font-semibold mb-1">Excluded Items</h3>
            <p className="text-sm text-muted-foreground mb-5">
              These job types are outside the scope of your Netic AI agent.
            </p>
            <CustomerExcludedList configVersionId={configVersionId} />
          </div>
        )}

        {/* Step 3: Items Needing Input */}
        {currentStep === 3 && (
          <div>
            <h3 className="text-lg font-semibold mb-1">
              Items Needing Your Input
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              These items couldn&apos;t be matched automatically. Please review
              each one and choose an action.
            </p>
            <CustomerAttentionCards configVersionId={configVersionId} />
          </div>
        )}

        {/* Step 4: Standard Rules */}
        {currentStep === 4 && (
          <div>
            <h3 className="text-lg font-semibold mb-1">Standard Rules</h3>
            <p className="text-sm text-muted-foreground mb-5">
              These rules apply to all Netic tenants. Contact us if you need
              customizations.
            </p>
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2">
                  Transfer & Escalation
                </h4>
                <p className="text-sm text-muted-foreground">
                  Calls are transferred to your team for: strong negative
                  experiences, commercial inquiries, warranty claims, complex
                  scheduling, pricing disputes, and more.
                </p>
              </div>
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2">Cancellations</h4>
                <p className="text-sm text-muted-foreground">
                  Standard cancellation reasons include: customer changed mind,
                  found another company, scheduling conflict, pricing concern,
                  and more.
                </p>
              </div>
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2">
                  Questions the AI Asks
                </h4>
                <p className="text-sm text-muted-foreground">
                  The AI agent asks relevant questions based on the job type
                  (e.g., &quot;How old is your system?&quot; for HVAC,
                  &quot;How many days has this been happening?&quot; for
                  plumbing).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Review & Confirm */}
        {currentStep === 5 && (
          <div>
            {confirmed ? (
              <div className="text-center py-12">
                <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
                <h3 className="text-2xl font-semibold mb-2">
                  Configuration Confirmed!
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Thank you for reviewing your configuration. Our team will
                  review it and you&apos;ll hear from us when it&apos;s live.
                </p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-semibold mb-1">
                  Review & Confirm
                </h3>
                <p className="text-sm text-muted-foreground mb-5">
                  Review the summary below. Once everything looks correct, check
                  the box and confirm.
                </p>

                {summary && (
                  <div className="border rounded-lg p-5 mb-5 bg-muted/20">
                    <h4 className="font-medium text-sm mb-3">
                      Configuration Summary
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-2xl font-semibold">
                          {summary.matched}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Job types configured
                        </p>
                      </div>
                      <div>
                        <p className="text-2xl font-semibold text-muted-foreground">
                          {summary.excluded}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Excluded
                        </p>
                      </div>
                      {summary.customerEdited > 0 && (
                        <div>
                          <p className="text-2xl font-semibold text-accent">
                            {summary.customerEdited}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Items you edited
                          </p>
                        </div>
                      )}
                      {summary.noMatch > 0 && (
                        <div>
                          <p className="text-2xl font-semibold text-destructive">
                            {summary.noMatch}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Unresolved
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-4 text-sm">
                      {Object.entries(summary.byTrade).map(
                        ([trade, count]) => (
                          <span key={trade} className="text-muted-foreground">
                            {trade}: <strong>{count}</strong>
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}

                <div className="border rounded-lg p-4 mb-5">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Confirmed by</p>
                      <p className="font-medium">
                        {session?.user?.name || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">
                        {session?.user?.email || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4 mb-5 bg-muted/10">
                  <p className="text-sm mb-3">
                    By confirming, I acknowledge that:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside mb-4">
                    <li>
                      I have reviewed all job types and their configurations
                    </li>
                    <li>The display names shown to customers are correct</li>
                    <li>
                      The booking, scheduling, and escalation rules reflect our
                      needs
                    </li>
                    <li>I can request changes after going live</li>
                  </ul>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmChecked}
                      onChange={(e) => setConfirmChecked(e.target.checked)}
                      className="h-5 w-5 rounded border-2 border-muted-foreground/40 accent-primary"
                    />
                    <span className="text-sm font-medium">
                      I confirm this configuration is ready for deployment
                    </span>
                  </label>
                </div>

                <button
                  onClick={handleConfirm}
                  disabled={!confirmChecked || confirming}
                  className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {confirming ? "Confirming..." : "Confirm Configuration"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      {!confirmed && (
        <div className="flex justify-between mt-6">
          <button
            onClick={() => goToStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary-hover transition-colors disabled:opacity-50"
          >
            Back
          </button>
          {currentStep < 5 && (
            <button
              onClick={() => goToStep(currentStep + 1)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
            >
              Continue
            </button>
          )}
        </div>
      )}
    </div>
  );
}
