"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { CompanySizeTier } from "@/lib/msp/types";
import { DashboardCompanyRow } from "./types";

type ResultsTableProps = {
  rows: DashboardCompanyRow[];
  allRowsCount?: number;
  loading: boolean;
  lastRunId: string | null;
  onScoreUpdate: (id: string, score: number | null) => Promise<void>;
};

function getScoreBadgeClass(score: number | null): string {
  if (score === null) return "bg-slate-100 text-slate-500 border-slate-200";
  if (score >= 8) return "bg-green-50 text-green-700 border-green-200";
  if (score >= 5) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}


const SIZE_TIER_CONFIG: Record<CompanySizeTier, { label: string; classes: string; title: string }> = {
  micro: {
    label: "Micro",
    classes: "bg-slate-100 text-slate-600 border-slate-200",
    title: "1–10 employees",
  },
  small: {
    label: "Small",
    classes: "bg-blue-50 text-blue-700 border-blue-200",
    title: "11–75 employees",
  },
  mid: {
    label: "Mid",
    classes: "bg-indigo-50 text-indigo-700 border-indigo-200",
    title: "76–300 employees",
  },
  large: {
    label: "Large",
    classes: "bg-violet-50 text-violet-700 border-violet-200",
    title: "300+ employees",
  },
};

function SizeTierBadge({ tier }: { tier: CompanySizeTier | null }) {
  if (!tier) {
    return <span className="text-slate-400 text-xs italic">Unknown</span>;
  }
  const cfg = SIZE_TIER_CONFIG[tier];
  return (
    <span
      title={cfg.title}
      className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide whitespace-nowrap ${cfg.classes}`}
    >
      {cfg.label}
    </span>
  );
}

function InlineScoreCell({
  row,
  onScoreUpdate,
}: {
  row: DashboardCompanyRow;
  onScoreUpdate: (id: string, score: number | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(row.score === null ? "" : String(row.score));
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    const trimmed = input.trim();
    const score = trimmed === "" ? null : Number(trimmed);

    if (score !== null && (!Number.isFinite(score) || score < 0 || score > 10)) return;

    setSaving(true);
    try {
      await onScoreUpdate(row.id, score);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [input, onScoreUpdate, row.id]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`inline-flex items-center border rounded-full px-2.5 py-1 text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity ${getScoreBadgeClass(row.score)}`}
        title="Click to score"
      >
        {row.score ?? "—"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={10}
        step={0.5}
        value={input}
        autoFocus
        placeholder="0–10"
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void handleSave();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="button"
        disabled={saving}
        onClick={() => void handleSave()}
        className="text-xs bg-blue-600 text-white rounded-lg px-2 py-1 hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs text-slate-400 hover:text-slate-600 px-1"
      >
        ✕
      </button>
    </div>
  );
}

const DISPLAY_LIMIT_OPTIONS = [25, 50, 100, 250] as const;
type DisplayLimit = (typeof DISPLAY_LIMIT_OPTIONS)[number] | "all";

export function ResultsTable({ rows, allRowsCount, loading, lastRunId, onScoreUpdate }: ResultsTableProps) {
  const [displayLimit, setDisplayLimit] = useState<DisplayLimit>(50);

  const visibleRows = displayLimit === "all" ? rows : rows.slice(0, displayLimit);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 flex items-center justify-center shadow-sm">
        <div className="flex items-center gap-2 text-slate-400">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading companies…</span>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 flex flex-col items-center justify-center gap-2 shadow-sm text-center">
        <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7m16 0v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5m16 0H4" />
        </svg>
        <p className="text-sm font-medium text-slate-600">No companies found</p>
        <p className="text-xs text-slate-400 max-w-xs">
          Try relaxing state, employee, or cloud filters — or run a new search.
        </p>
      </div>
    );
  }

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
        <h2 className="text-sm font-semibold text-slate-800">
          Companies
          <span className="ml-2 text-xs font-normal text-slate-400">
            {visibleRows.length < rows.length
              ? `showing ${visibleRows.length} of ${rows.length}`
              : `${rows.length} result${rows.length !== 1 ? "s" : ""}`}
            {allRowsCount !== undefined && allRowsCount !== rows.length
              ? ` (${allRowsCount} total)`
              : ""}
          </span>
        </h2>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Show</span>
          {([25, 50, 100, 250, "all"] as DisplayLimit[]).map((opt) => (
            <button
              key={String(opt)}
              type="button"
              onClick={() => setDisplayLimit(opt)}
              className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${
                displayLimit === opt
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              {opt === "all" ? "All" : opt}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-auto max-h-[74vh]">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
            <tr>
              {["Company", "Website", "Evidence", "Geography", "Size", "Score"].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {visibleRows.map((row) => {
              return (
                <tr
                  key={row.id}
                  className="align-top hover:bg-slate-50/60 transition-colors"
                >
                  <td className="px-3 py-3 font-medium max-w-[180px]">
                    <div className="flex items-start gap-1.5 flex-wrap">
                      <Link
                        href={`/companies/${row.id}`}
                        className="text-blue-700 hover:text-blue-900 hover:underline leading-snug"
                      >
                        {row.companyName}
                      </Link>
                      {lastRunId && row.latestRunId === lastRunId ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 border border-green-300 text-green-700 text-[9px] font-bold px-1.5 py-0.5 leading-none uppercase tracking-wide flex-shrink-0">
                          New
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-3 max-w-[160px]">
                    {row.website ? (
                      <a
                        href={row.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 hover:underline break-all text-xs leading-relaxed"
                      >
                        {row.website.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    ) : (
                      <span className="text-slate-400 text-xs italic">Unknown</span>
                    )}
                  </td>
                  <td className="px-3 py-3 max-w-[400px]">
                    <p className="text-xs text-slate-700 leading-relaxed line-clamp-4 whitespace-pre-wrap">
                      {row.evidence}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">
                    {row.geography ?? <span className="text-slate-400 italic">Unknown</span>}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <SizeTierBadge tier={row.companySizeTier} />
                  </td>
                  <td className="px-3 py-3">
                    <InlineScoreCell row={row} onScoreUpdate={onScoreUpdate} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
