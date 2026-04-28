"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CompanyDetail, CompanySizeTier } from "@/lib/msp/types";

type CompanyDetailViewProps = {
  companyId: string;
};


function SourceTypeBorderClass(sourceType: string): string {
  if (sourceType === "official_website") return "border-l-green-400";
  if (sourceType === "linkedin") return "border-l-blue-400";
  if (sourceType === "partner_directory") return "border-l-purple-400";
  return "border-l-slate-300";
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-400 font-medium w-36 flex-shrink-0">{label}</span>
      <span className="text-xs text-slate-700">{value}</span>
    </div>
  );
}

function YesNo({ value }: { value: boolean }) {
  return value ? (
    <span className="text-green-700 font-medium">Yes</span>
  ) : (
    <span className="text-slate-400">No</span>
  );
}

const SIZE_TIER_DETAIL: Record<CompanySizeTier, { label: string; subtitle: string; classes: string }> = {
  micro: { label: "Micro", subtitle: "1–10 employees", classes: "bg-slate-100 text-slate-600 border-slate-200" },
  small: { label: "Small", subtitle: "11–75 employees", classes: "bg-blue-50 text-blue-700 border-blue-200" },
  mid:   { label: "Mid",   subtitle: "76–300 employees", classes: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  large: { label: "Large", subtitle: "300+ employees",   classes: "bg-violet-50 text-violet-700 border-violet-200" },
};

function SizeTierBadge({ tier }: { tier: CompanySizeTier | null }) {
  if (!tier) return <span className="text-slate-400">Unknown</span>;
  const cfg = SIZE_TIER_DETAIL[tier];
  return (
    <span
      title={cfg.subtitle}
      className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide ${cfg.classes}`}
    >
      {cfg.label} <span className="ml-1 normal-case font-normal text-[9px] opacity-70">({cfg.subtitle})</span>
    </span>
  );
}

export function CompanyDetailView({ companyId }: CompanyDetailViewProps) {
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingScore, setSavingScore] = useState(false);
  const [scoreInput, setScoreInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/companies/${companyId}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to load company detail.");
      }

      const payload = (await response.json()) as CompanyDetail;
      setDetail(payload);
      setScoreInput(payload.score === null ? "" : String(payload.score));
      setNotesInput(payload.notes ?? "");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load company.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const scoreValue = useMemo(() => {
    if (!scoreInput.trim()) return null;
    const parsed = Number(scoreInput);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  }, [scoreInput]);

  const handleSaveScore = useCallback(async () => {
    if (scoreValue !== null && (scoreValue < 0 || scoreValue > 10)) {
      setErrorMessage("Score must be a number between 0 and 10.");
      return;
    }

    setSavingScore(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/companies/${companyId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: scoreValue, note: null }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to save score.");
      }

      const payload = (await response.json()) as CompanyDetail;
      setDetail(payload);
      setStatusMessage("Score saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save score.");
    } finally {
      setSavingScore(false);
    }
  }, [companyId, scoreValue]);

  const handleSaveNotes = useCallback(async () => {
    const notes = notesInput.trim() || null;

    setSavingNotes(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/companies/${companyId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to save notes.");
      }

      setDetail((prev) => (prev ? { ...prev, notes } : prev));
      setStatusMessage("Notes saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save notes.");
    } finally {
      setSavingNotes(false);
    }
  }, [companyId, notesInput]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 justify-center text-slate-400">
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm">Loading company detail…</span>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-3 py-12 text-center">
        <p className="text-sm text-red-600 font-medium">Company not found.</p>
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400">
        <Link href="/dashboard" className="hover:text-blue-600 transition-colors font-medium">
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-slate-600 font-medium truncate max-w-xs">{detail.companyName}</span>
      </nav>

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{detail.companyName}</h1>
            <p className="text-sm text-slate-500 flex items-center gap-2 flex-wrap">
              {detail.geography ?? "Unknown location"}
              {detail.companySizeTier ? (
                <SizeTierBadge tier={detail.companySizeTier} />
              ) : detail.employeeCount ? (
                <span>· {detail.employeeCount} employees</span>
              ) : null}
            </p>
            {detail.website ? (
              <a
                href={detail.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline break-all"
              >
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0-5.656-5.656l-1.1 1.1" />
                </svg>
                {detail.website}
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {/* Status messages */}
      {statusMessage ? (
        <div className="flex gap-3 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
          <div className="w-1 rounded-full bg-green-400 flex-shrink-0" />
          <p>{statusMessage}</p>
        </div>
      ) : null}
      {errorMessage ? (
        <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          <div className="w-1 rounded-full bg-red-400 flex-shrink-0" />
          <p>{errorMessage}</p>
        </div>
      ) : null}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Confidence", value: `${detail.internalConfidence}/100`, accent: "border-t-blue-400" },
          { label: "Score", value: detail.score !== null ? String(detail.score) : "Unscored", accent: "border-t-amber-400" },
          { label: "Sources", value: String(detail.sources.length), accent: "border-t-purple-400" },
        ].map(({ label, value, accent }) => (
          <div key={label} className={`bg-white border border-slate-200 rounded-xl p-3 shadow-sm border-t-2 ${accent}`}>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
            <div className="text-lg font-bold text-slate-900 leading-tight">{value}</div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5 items-start">
        {/* Left column */}
        <div className="space-y-5">
          {/* Evidence Summary */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">Evidence Summary</h2>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {detail.evidenceSummary}
            </p>
          </section>

          {/* Source URLs */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">
              Source URLs
              <span className="ml-2 text-xs font-normal text-slate-400">({detail.sources.length})</span>
            </h2>
            <ul className="space-y-2">
              {detail.sources.map((source, index) => (
                <li
                  key={`${source.url}-${index}`}
                  className={`text-sm border-l-4 border border-slate-100 rounded-lg p-3 bg-slate-50/40 ${SourceTypeBorderClass(source.sourceType)}`}
                >
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-700 hover:text-blue-900 hover:underline break-all font-medium text-xs"
                  >
                    {source.title || source.url}
                  </a>
                  <p className="mt-1 text-slate-600 text-xs leading-relaxed">{source.claim}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* Extracted Data */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">Extracted Data</h2>
            <div className="divide-y divide-slate-50">
              <DataRow label="Geography" value={detail.geography ?? "Unknown"} />
              <DataRow label="Company Size" value={<SizeTierBadge tier={detail.companySizeTier} />} />
              <DataRow label="Employee Count (exact)" value={detail.extractedData.employeeCountExact ?? "Unknown"} />
              <DataRow
                label="Employee Range"
                value={
                  detail.extractedData.employeeCountMin !== null && detail.extractedData.employeeCountMax !== null
                    ? `${detail.extractedData.employeeCountMin}–${detail.extractedData.employeeCountMax}`
                    : "Unknown"
                }
              />
              <DataRow label="AWS Support" value={<YesNo value={detail.capabilities.awsSupport} />} />
              <DataRow label="Azure Support" value={<YesNo value={detail.capabilities.azureSupport} />} />
              <DataRow label="AWS Reseller Confirmed" value={<YesNo value={detail.capabilities.awsResellerConfirmed} />} />
              <DataRow
                label="Azure Partner Evidence"
                value={<YesNo value={detail.capabilities.azurePartnerClaimed || detail.capabilities.azureResellerConfirmed} />}
              />
            </div>
          </section>
        </div>

        {/* Right column — Score panel */}
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm xl:sticky xl:top-20 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
            <h2 className="text-sm font-semibold text-slate-800">Score this Lead</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="score" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Score (0–10)
              </label>
              <input
                id="score"
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={scoreInput}
                onChange={(e) => setScoreInput(e.target.value)}
                placeholder="Enter 0–10 or clear to unset"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-[10px] text-slate-400 leading-snug">
                0 = bad lead · 10 = perfect fit · clear to mark unscored
              </p>
            </div>
            <button
              type="button"
              disabled={savingScore}
              onClick={() => void handleSaveScore()}
              className="w-full bg-blue-600 text-white rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
            >
              {savingScore ? "Saving…" : "Save Score"}
            </button>
          </div>
          <div className="px-4 pb-4 pt-1 space-y-1.5 border-t border-slate-100">
            <label htmlFor="notes" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Notes
            </label>
            <textarea
              id="notes"
              rows={4}
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              placeholder="Add notes about this lead…"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <button
              type="button"
              disabled={savingNotes}
              onClick={() => void handleSaveNotes()}
              className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
            >
              {savingNotes ? "Saving…" : "Save Notes"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
