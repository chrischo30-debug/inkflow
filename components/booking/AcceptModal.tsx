"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, DollarSign, Plus, ArrowRight, Check, Layers } from "lucide-react";
import type { BookingState } from "@/lib/types";
import type { SchedulingLink } from "@/lib/pipeline-settings";
import { EmailComposeModal, type InsertLink, type ResolvedTemplate } from "./EmailComposeModal";
import { SchedulingLinkForm, useCalendarOptions, newLinkDraft, generateId, DURATIONS, type LinkDraft } from "@/components/shared/SchedulingLinkForm";

interface Props {
  bookingId: string;
  clientName?: string;
  paymentsConnected?: boolean;
  paymentProvider?: "stripe" | "square" | null;
  schedulingLinks?: SchedulingLink[];
  artistId?: string;
  isCalendarConnected?: boolean;
  onSent: (threadId?: string, targetState?: BookingState) => void;
  onClose: () => void;
}

interface EmailData {
  subject: string;
  body: string;
  templates: ResolvedTemplate[];
  paymentLinks: InsertLink[];
  calendarLinks: InsertLink[];
  schedulingLinks?: { id: string; label: string }[];
  previewVars?: Record<string, string>;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AcceptModal({
  bookingId,
  clientName = "this client",
  paymentsConnected = false,
  paymentProvider = null,
  schedulingLinks: initialLinks = [],
  artistId = "",
  isCalendarConnected = false,
  onSent,
  onClose,
}: Props) {
  const providerLabel = paymentProvider === "square" ? "Square" : "Stripe";
  const [stage, setStage] = useState<"setup" | "email">("setup");
  const [data, setData] = useState<EmailData | null>(null);
  const [loading, setLoading] = useState(true);

  // Scheduling link state
  const [schedulingLinks, setSchedulingLinks] = useState<SchedulingLink[]>(initialLinks);
  const [selectedLinkId, setSelectedLinkId] = useState<string>(initialLinks[0]?.id ?? "");
  const [creatingLink, setCreatingLink] = useState(initialLinks.length === 0);
  const [newLink, setNewLink] = useState<LinkDraft>(newLinkDraft());
  const { calendarOptions, calendarsLoading } = useCalendarOptions(isCalendarConnected);

  // Deposit state. "provider" mode = generate via the active payment provider (Stripe or Square).
  const [depositMode, setDepositMode] = useState<"provider" | "existing" | "none">(paymentsConnected ? "provider" : "existing");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositUrl, setDepositUrl] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [depositError, setDepositError] = useState("");
  const [selectedExistingPaymentUrl, setSelectedExistingPaymentUrl] = useState<string>("");

  // Multi-session state. Each entry is one of sessions 2..N, and uses the
  // same "existing or new" picker as session 1 (the primary link above).
  type FollowUp = { mode: "existing" | "new"; linkId: string; draft: LinkDraft };
  const [sessionCount, setSessionCount] = useState(1);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const newFollowUp = (): FollowUp => ({
    mode: initialLinks.length > 0 ? "existing" : "new",
    linkId: selectedLinkId,
    draft: newLinkDraft(),
  });
  const updateFollowUp = (i: number, patch: Partial<FollowUp> | ((prev: FollowUp) => FollowUp)) => {
    setFollowUps(prev => prev.map((fu, idx) => {
      if (idx !== i) return fu;
      return typeof patch === "function" ? patch(fu) : { ...fu, ...patch };
    }));
  };

  const [setupError, setSetupError] = useState("");
  const [savingScheduling, setSavingScheduling] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/bookings/${bookingId}/send-email`);
        if (!res.ok) return;
        const d: EmailData = await res.json();
        setData(d);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [bookingId]);

  // When switching to existing-link deposit mode, default to first available
  useEffect(() => {
    if (depositMode === "existing" && data && !selectedExistingPaymentUrl) {
      const first = data.paymentLinks[0];
      if (first) setSelectedExistingPaymentUrl(first.url);
    }
  }, [depositMode, data, selectedExistingPaymentUrl]);

  const generateDepositLink = async () => {
    const cents = Math.round(parseFloat(depositAmount) * 100);
    if (!cents || cents < 100) { setDepositError("Enter a valid amount (min $1)"); return; }
    setGeneratingLink(true); setDepositError("");
    try {
      const res = await fetch(`/api/bookings/${bookingId}/deposit-link`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_cents: cents }),
      });
      const dataResp = await res.json();
      if (!res.ok) { setDepositError(dataResp.error ?? "Failed to generate link"); return; }
      setDepositUrl(dataResp.url);
    } catch { setDepositError("Network error"); }
    finally { setGeneratingLink(false); }
  };

  const persistSchedulingLinks = async (links: SchedulingLink[]): Promise<boolean> => {
    const res = await fetch("/api/artist/scheduling-links", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ links }),
    });
    return res.ok;
  };

  const buildLinkFromDraft = (draft: LinkDraft): SchedulingLink | null => {
    if (!draft.label.trim() || draft.days.length === 0 || draft.start_hour >= draft.end_hour) return null;
    return { ...draft, id: generateId(), label: draft.label.trim() };
  };

  // Resolve which deposit URL to inject into the email body
  const effectiveDepositUrl = useMemo(() => {
    if (depositMode === "provider") return depositUrl;
    if (depositMode === "existing") return selectedExistingPaymentUrl;
    return "";
  }, [depositMode, depositUrl, selectedExistingPaymentUrl]);

  const proceedToEmail = async () => {
    setSetupError("");

    // Resolve session 1's link (primary). Persist any new links, then we have
    // the full link object — title, duration, etc. — for email rendering.
    setSavingScheduling(true);
    const allLinks: SchedulingLink[] = [...schedulingLinks];
    let session1Link: SchedulingLink | null;
    if (creatingLink) {
      session1Link = buildLinkFromDraft(newLink);
      if (!session1Link) {
        setSavingScheduling(false);
        setSetupError("Add a label for the new scheduling link first.");
        return;
      }
      allLinks.push(session1Link);
    } else {
      session1Link = schedulingLinks.find(l => l.id === selectedLinkId) ?? null;
      if (!session1Link) {
        setSavingScheduling(false);
        setSetupError("Pick or create a scheduling link for session 1.");
        return;
      }
    }

    // Resolve sessions 2..N
    const sessionLinks: SchedulingLink[] = [session1Link];
    for (let i = 0; i < followUps.length; i++) {
      const fu = followUps[i];
      if (fu.mode === "new") {
        const built = buildLinkFromDraft(fu.draft);
        if (!built) {
          setSavingScheduling(false);
          setSetupError(`Add a label for session ${i + 2}'s new scheduling link.`);
          return;
        }
        allLinks.push(built);
        sessionLinks.push(built);
      } else {
        const existing = allLinks.find(l => l.id === fu.linkId);
        if (!existing) {
          setSavingScheduling(false);
          setSetupError(`Pick a scheduling link for session ${i + 2}.`);
          return;
        }
        sessionLinks.push(existing);
      }
    }

    // Persist all (existing + new) scheduling links if any new ones were built.
    if (allLinks.length !== schedulingLinks.length) {
      const ok = await persistSchedulingLinks(allLinks);
      if (!ok) {
        setSavingScheduling(false);
        setSetupError("Failed to save new scheduling link.");
        return;
      }
      setSchedulingLinks(allLinks);
      setSelectedLinkId(session1Link.id);
      setCreatingLink(false);
    }
    setSavingScheduling(false);

    // Validate deposit
    if (depositMode === "provider" && !depositUrl) {
      setSetupError(`Generate the ${providerLabel} deposit link first, or switch to a saved payment link.`);
      return;
    }
    if (depositMode === "existing" && !selectedExistingPaymentUrl) {
      setSetupError(paymentsConnected
        ? `Pick a saved payment link, or switch to ${providerLabel}.`
        : "Pick a saved payment link.");
      return;
    }

    // Persist scheduling_link_id and session info now so the payment webhook can use it later
    await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "edit_details",
        scheduling_link_id: session1Link.id,
        session_count: sessionCount,
        ...(sessionLinks.length > 1
          ? { session_durations: sessionLinks.slice(1).map(l => l.duration_minutes) }
          : {}),
      }),
    }).catch(() => { /* fall through; PATCH on send will retry */ });

    // Switch to email compose. The body depends on whether a deposit was set:
    // - With deposit: use the "Deposit Request" (accepted) template, with
    //   {paymentLink} substituted for the chosen deposit hyperlink.
    // - Without deposit: use a separate scheduling-only template that doesn't
    //   mention deposit at all — sending the deposit-request copy with
    //   {paymentLink} swapped to the schedule URL leaves a body that still
    //   says "send the deposit here", which is wrong.
    if (data) {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      let baseBody: string;
      let baseSubject: string;
      let body: string;

      if (effectiveDepositUrl) {
        const acceptedTpl = data.templates.find(t => t.state === "accepted");
        baseBody = acceptedTpl?.body ?? data.body;
        baseSubject = acceptedTpl?.subject ?? data.subject;
        const depositLabel =
          data.paymentLinks.find(l => l.url === effectiveDepositUrl)?.label ?? "Pay deposit";
        body = baseBody.replace(
          /\{paymentLink(?::[^}]+)?\}/g,
          `[${depositLabel}](${effectiveDepositUrl})`
        );
      } else if (session1Link) {
        // No-deposit accept flow — schedule-only copy.
        baseSubject = "Pick your appointment time";
        const schedUrl = `${origin}/schedule/${artistId}/${session1Link.id}?bid=${bookingId}`;
        body = `Hi {clientFirstName},\n\nI'd love to do this tattoo. Pick a time that works for you here:\n\n[${session1Link.label}](${schedUrl})\n\n{artistName}`;
      } else {
        // Defensive fallback — proceed with the accepted template untouched.
        const acceptedTpl = data.templates.find(t => t.state === "accepted");
        baseBody = acceptedTpl?.body ?? data.body;
        baseSubject = acceptedTpl?.subject ?? data.subject;
        body = baseBody;
      }

      if (sessionCount > 1) {
        const formatHours = (mins: number) => {
          const h = mins / 60;
          return Number.isInteger(h) ? `${h} hr${h === 1 ? "" : "s"}` : `${h} hrs`;
        };
        const sessionLines = sessionLinks.map((l, idx) =>
          `Session ${idx + 1} (${formatHours(l.duration_minutes)}): [${l.label}](${origin}/schedule/${artistId}/${l.id}?bid=${bookingId}&session=${idx + 1})`
        );
        const intro = effectiveDepositUrl
          ? (sessionCount === 2
              ? "This is a 2-session booking. Once your deposit clears, use these links to schedule each session:"
              : "This is a multi-session booking. Once your deposit clears, use these links to schedule each session:")
          : (sessionCount === 2
              ? "This is a 2-session booking. Use these links to schedule each session:"
              : "This is a multi-session booking. Use these links to schedule each session:");
        // For the no-deposit path, the body already includes the session 1 link
        // inline — replace it with the multi-session breakdown rather than
        // appending so we don't list session 1 twice.
        if (!effectiveDepositUrl && session1Link) {
          body = `Hi {clientFirstName},\n\nI'd love to do this tattoo. ${intro}\n\n${sessionLines.join("\n\n")}\n\n{artistName}`;
        } else {
          body = `${body.trimEnd()}\n\n${intro}\n\n${sessionLines.join("\n\n")}`;
        }
      }

      setData({ ...data, subject: baseSubject, body });
    }

    // Clear any stale draft from a previous Accept session so the freshly
    // substituted body (with the actual deposit URL + session links) wins
    // over a saved draft that still has {paymentLink} unresolved.
    try {
      window.localStorage.removeItem(`fb:email-draft:${bookingId}:accept`);
    } catch { /* storage disabled — fine */ }

    setStage("email");
  };

  const handleSend = async (subject: string, body: string) => {
    const linkId = selectedLinkId;
    const res = await fetch(`/api/bookings/${bookingId}/send-email`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });
    if (!res.ok) throw new Error("Failed to send email");
    const result = await res.json();

    // Move to the right stage based on whether a deposit was actually set:
    // - With deposit → sent_deposit (deposit_paid will auto-advance to sent_calendar via webhook)
    // - Without deposit → sent_calendar directly (the email already carries scheduling links)
    const targetState: BookingState = depositMode === "none" ? "sent_calendar" : "sent_deposit";
    await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "move",
        target_state: targetState,
        ...(linkId ? { scheduling_link_id: linkId } : {}),
      }),
    });

    onSent(result.threadId, targetState);
  };

  const handleSkip = async () => {
    const linkId = selectedLinkId;
    const targetState: BookingState = depositMode === "none" ? "sent_calendar" : "sent_deposit";
    await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "move",
        target_state: targetState,
        ...(linkId ? { scheduling_link_id: linkId } : {}),
      }),
    });
    onSent(undefined, targetState);
  };

  if (loading) return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-2xl shadow-xl px-8 py-6 text-sm text-on-surface-variant">Loading…</div>
    </div>,
    document.body,
  );

  if (stage === "email" && data) {
    return (
      <EmailComposeModal
        templates={data.templates}
        initialSubject={data.subject}
        initialBody={data.body}
        defaultTemplateState="accepted"
        paymentLinks={data.paymentLinks}
        calendarLinks={data.calendarLinks}
        schedulingLinks={data.schedulingLinks ?? schedulingLinks.map(l => ({ id: l.id, label: l.label }))}
        previewVars={data.previewVars}
        draftKey={`fb:email-draft:${bookingId}:accept`}
        onSend={handleSend}
        onSkip={handleSkip}
        onClose={onClose}
      />
    );
  }

  // Setup stage
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface border border-outline-variant/20 rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b border-outline-variant/10 shrink-0">
          <h2 className="text-base font-semibold text-on-surface">Accept booking</h2>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Set up scheduling and deposit for {clientName}. Once done, the rest is automatic.
          </p>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {/* Step 1: Scheduling link */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-on-surface-variant" />
              <p className="text-xs font-semibold text-on-surface uppercase tracking-wide">Scheduling link</p>
            </div>
            <p className="text-xs text-on-surface-variant">
              The client will get this link after the deposit is paid, so they can book a time.
            </p>

            {schedulingLinks.length > 0 && !creatingLink && (
              <div className="space-y-2">
                {schedulingLinks.map(l => (
                  <label key={l.id} className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-lg border border-outline-variant/20 hover:bg-surface-container-low transition-colors"
                    onClick={() => setSelectedLinkId(l.id)}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedLinkId === l.id ? "border-on-surface" : "border-outline-variant/50"}`}>
                      {selectedLinkId === l.id && <div className="w-2 h-2 rounded-full bg-on-surface" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-on-surface">{l.label}</p>
                      <p className="text-xs text-on-surface-variant">{l.duration_minutes / 60}h · {l.days.map(d => DAY_LABELS[d]).join(", ")}</p>
                    </div>
                  </label>
                ))}
                <button type="button" onClick={() => setCreatingLink(true)}
                  className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Create new link
                </button>
              </div>
            )}

            {creatingLink && (
              <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-on-surface-variant">New scheduling link</p>
                  {schedulingLinks.length > 0 && (
                    <button type="button" onClick={() => setCreatingLink(false)} className="text-sm text-on-surface-variant hover:text-on-surface-variant underline">
                      Use existing
                    </button>
                  )}
                </div>
                <SchedulingLinkForm
                  draft={newLink}
                  setDraft={updater => setNewLink(updater)}
                  isCalendarConnected={isCalendarConnected}
                  calendarOptions={calendarOptions}
                  calendarsLoading={calendarsLoading}
                />
              </div>
            )}
          </section>

          {/* Step 2: Sessions */}
          <section className="space-y-3 border-t border-outline-variant/10 pt-5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-on-surface-variant" />
              <p className="text-xs font-semibold text-on-surface uppercase tracking-wide">Sessions</p>
            </div>
            <p className="text-xs text-on-surface-variant">
              How many appointments does this booking require? One deposit covers all of them.
            </p>
            <div className="flex items-center gap-3">
              <button type="button"
                onClick={() => {
                  const next = Math.max(1, sessionCount - 1);
                  setSessionCount(next);
                  setFollowUps(prev => prev.slice(0, next - 1));
                }}
                disabled={sessionCount <= 1}
                className="w-8 h-8 rounded-lg border border-outline-variant/30 flex items-center justify-center text-sm font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                −
              </button>
              <span className="text-sm font-semibold text-on-surface w-4 text-center">{sessionCount}</span>
              <button type="button"
                onClick={() => {
                  const next = Math.min(6, sessionCount + 1);
                  setSessionCount(next);
                  setFollowUps(prev => {
                    const arr = [...prev];
                    while (arr.length < next - 1) arr.push(newFollowUp());
                    return arr;
                  });
                }}
                disabled={sessionCount >= 6}
                className="w-8 h-8 rounded-lg border border-outline-variant/30 flex items-center justify-center text-sm font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                +
              </button>
              <span className="text-xs text-on-surface-variant">{sessionCount === 1 ? "Single session" : `${sessionCount} sessions total`}</span>
            </div>

            {followUps.map((fu, i) => {
              const sessionNum = i + 2;
              const durationLabelFor = (lid: string) =>
                DURATIONS.find(d => d.minutes === schedulingLinks.find(l => l.id === lid)?.duration_minutes)?.label;
              return (
                <div key={i} className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-3 space-y-3">
                  <p className="text-xs font-semibold text-on-surface uppercase tracking-wide">Session {sessionNum}</p>

                  {fu.mode === "existing" && schedulingLinks.length > 0 && (
                    <>
                      <div className="space-y-1.5">
                        {schedulingLinks.map(l => (
                          <label key={l.id} className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg border border-outline-variant/20 hover:bg-surface-container transition-colors"
                            onClick={() => updateFollowUp(i, { linkId: l.id })}>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${fu.linkId === l.id ? "border-on-surface" : "border-outline-variant/50"}`}>
                              {fu.linkId === l.id && <div className="w-2 h-2 rounded-full bg-on-surface" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-on-surface truncate">{l.label}</p>
                              <p className="text-xs text-on-surface-variant">{l.duration_minutes / 60}h · {l.days.map(d => DAY_LABELS[d]).join(", ")}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                      <button type="button" onClick={() => updateFollowUp(i, { mode: "new" })}
                        className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors">
                        <Plus className="w-3.5 h-3.5" /> Create new link for this session
                      </button>
                    </>
                  )}

                  {fu.mode === "new" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-on-surface-variant">New scheduling link</p>
                        {schedulingLinks.length > 0 && (
                          <button type="button" onClick={() => updateFollowUp(i, { mode: "existing" })}
                            className="text-sm text-on-surface-variant hover:text-on-surface-variant underline">
                            Use existing
                          </button>
                        )}
                      </div>
                      <SchedulingLinkForm
                        draft={fu.draft}
                        setDraft={updater => updateFollowUp(i, prev => ({ ...prev, draft: updater(prev.draft) }))}
                        isCalendarConnected={isCalendarConnected}
                        calendarOptions={calendarOptions}
                        calendarsLoading={calendarsLoading}
                      />
                    </div>
                  )}

                  {fu.mode === "existing" && fu.linkId && (
                    <p className="text-[11px] text-on-surface-variant/70">
                      Session {sessionNum} duration: {durationLabelFor(fu.linkId) ?? "—"}
                    </p>
                  )}
                </div>
              );
            })}
          </section>

          {/* Step 3: Deposit */}
          <section className="space-y-3 border-t border-outline-variant/10 pt-5">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-on-surface-variant" />
              <p className="text-xs font-semibold text-on-surface uppercase tracking-wide">Deposit link</p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {paymentsConnected && (
                <button type="button" onClick={() => setDepositMode("provider")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${depositMode === "provider" ? "bg-on-surface text-surface border-on-surface" : "bg-surface border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high"}`}>
                  Generate {providerLabel} link
                </button>
              )}
              <button type="button" onClick={() => setDepositMode("existing")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${depositMode === "existing" ? "bg-on-surface text-surface border-on-surface" : "bg-surface border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high"}`}>
                Use saved payment link
              </button>
              <button type="button" onClick={() => setDepositMode("none")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${depositMode === "none" ? "bg-on-surface text-surface border-on-surface" : "bg-surface border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high"}`}>
                No deposit link
              </button>
            </div>

            {depositMode === "provider" && (
              <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 space-y-3">
                <div className="flex gap-2">
                  <div className="flex items-center gap-1 flex-1 rounded-lg border border-outline-variant/30 bg-surface px-3 py-2 focus-within:border-primary transition-colors">
                    <span className="text-sm text-on-surface-variant">$</span>
                    <input type="number" min="1" step="0.01" placeholder="0.00" value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && generateDepositLink()}
                      className="flex-1 bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant/50" />
                  </div>
                  <button type="button" onClick={generateDepositLink} disabled={generatingLink || !!depositUrl}
                    className="px-3 py-2 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 disabled:opacity-50 transition-opacity whitespace-nowrap">
                    {generatingLink ? "Creating…" : depositUrl ? <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Created</span> : "Generate"}
                  </button>
                </div>
                {depositUrl && (
                  <p className="text-[11px] font-mono text-on-surface-variant/60 truncate">{depositUrl}</p>
                )}
                {depositError && <p className="text-xs text-destructive">{depositError}</p>}
                <p className="text-[11px] text-on-surface-variant/70">
                  When the client pays, they automatically get the scheduling link above.
                </p>
              </div>
            )}

            {depositMode === "existing" && (
              <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 space-y-2">
                {data && data.paymentLinks.length > 0 ? (
                  <div className="space-y-1.5">
                    {data.paymentLinks.map(link => (
                      <label key={link.url} className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-surface-container-high transition-colors"
                        onClick={() => setSelectedExistingPaymentUrl(link.url)}>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedExistingPaymentUrl === link.url ? "border-on-surface" : "border-outline-variant/50"}`}>
                          {selectedExistingPaymentUrl === link.url && <div className="w-2 h-2 rounded-full bg-on-surface" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-on-surface truncate">{link.label}</p>
                          <p className="text-[11px] text-on-surface-variant/70 truncate">{link.url}</p>
                        </div>
                      </label>
                    ))}
                    <a href="/payment-links"
                      className="flex items-center gap-1.5 px-2 pt-1 text-xs font-medium text-primary hover:underline">
                      <Plus className="w-3.5 h-3.5" /> Add a new payment link
                    </a>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-2">
                      {paymentsConnected
                        ? `With a saved link, you'll need to mark the deposit paid manually — auto-detection only works with ${providerLabel}-generated links.`
                        : <>No payment provider is configured, so you&apos;ll confirm deposits manually. Set one up in <a href="/settings?tab=integrations" className="underline">Settings → Integrations</a> to enable auto-detection.</>
                      }
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant">
                    No saved payment links yet. <a href="/payment-links" className="text-primary underline">Add one →</a>{paymentsConnected ? ` Or use ${providerLabel} for auto-detection.` : ""}
                  </p>
                )}
              </div>
            )}

            {depositMode === "none" && (
              <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-3">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  No deposit asked. You&apos;ll need to confirm and follow up with the client manually.
                </p>
              </div>
            )}
          </section>

          {setupError && <p className="text-xs text-destructive">{setupError}</p>}
        </div>

        <div className="px-6 pb-6 pt-4 border-t border-outline-variant/10 shrink-0 flex justify-between items-center gap-3">
          <button type="button" onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors">
            Cancel
          </button>
          <button type="button" onClick={proceedToEmail} disabled={savingScheduling}
            className="px-5 py-2.5 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 disabled:opacity-40 transition-opacity flex items-center gap-2">
            {savingScheduling ? "Saving…" : <>Continue to email <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
