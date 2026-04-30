"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CompanySizeTier } from "@/lib/msp/types";
import { DashboardToolbar } from "./dashboard-toolbar";
import { FilterPanel } from "./filter-panel";
import { ResultsTable } from "./results-table";
import { DashboardCompanyRow, DashboardFilters, ResultsAgeFilter, ScoreFilter } from "./types";

function getDefaultFilters(): DashboardFilters {
  return {
    states: [],
    city: "",
    mustSupportAws: false,
    mustSupportAzure: false,
    resultLimit: "50",
    extraCriteria: "",
    seedCompanies: "",
    resultsView: "all",
    scoreFilter: "all",
    sizeTiers: [],
  };
}

function applyDisplayFilters(
  rows: DashboardCompanyRow[],
  lastRunId: string | null,
  resultsView: ResultsAgeFilter,
  scoreFilter: ScoreFilter,
  sizeTiers: CompanySizeTier[],
): DashboardCompanyRow[] {
  return rows.filter((row) => {
    if (resultsView === "new") {
      if (!lastRunId || row.latestRunId !== lastRunId) return false;
    } else if (resultsView === "old") {
      if (lastRunId && row.latestRunId === lastRunId) return false;
    }

    if (scoreFilter === "unscored") {
      if (row.score !== null) return false;
    } else if (scoreFilter === "high") {
      if (row.score === null || row.score < 8) return false;
    } else if (scoreFilter === "medium") {
      if (row.score === null || row.score < 5 || row.score >= 8) return false;
    } else if (scoreFilter === "low") {
      if (row.score === null || row.score >= 5) return false;
    }

    if (sizeTiers.length > 0) {
      if (!row.companySizeTier || !sizeTiers.includes(row.companySizeTier)) return false;
    }

    return true;
  });
}

function parseNumberOrNull(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.trunc(parsed);
}

function toApiFilters(filters: DashboardFilters) {
  return {
    states: filters.states,
    city: filters.city.trim() || null,
    mustSupportAws: filters.mustSupportAws,
    mustSupportAzure: filters.mustSupportAzure,
    showOnlyVerified: false,
    includeNeedsReview: true,
    resultLimit: parseNumberOrNull(filters.resultLimit) ?? 50,
    extraCriteria: filters.extraCriteria.trim() || null,
    seedCompanies: filters.seedCompanies
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

function filtersToQuery(filters: DashboardFilters) {
  const params = new URLSearchParams();

  for (const state of filters.states) {
    params.append("state", state);
  }

  if (filters.city.trim()) {
    params.set("city", filters.city.trim());
  }

  if (filters.mustSupportAws) {
    params.set("mustSupportAws", "true");
  }

  if (filters.mustSupportAzure) {
    params.set("mustSupportAzure", "true");
  }

  if (filters.extraCriteria.trim()) {
    params.set("extraCriteria", filters.extraCriteria.trim());
  }

  return params.toString();
}

function getActiveFilterLabels(filters: DashboardFilters): string[] {
  const labels: string[] = [];

  if (filters.states.length > 0) {
    labels.push(`States: ${filters.states.join(", ")}`);
  }
  if (filters.city.trim()) {
    labels.push(`City: ${filters.city.trim()}`);
  }
  if (filters.mustSupportAws) {
    labels.push("Must support AWS");
  }
  if (filters.mustSupportAzure) {
    labels.push("Must support Azure");
  }
  if (filters.sizeTiers.length > 0) {
    const tierLabels: Record<string, string> = { micro: "Micro", small: "Small", mid: "Mid", large: "Large" };
    labels.push(`Size: ${filters.sizeTiers.map((t) => tierLabels[t] ?? t).join(", ")}`);
  }
  if (filters.extraCriteria.trim()) {
    labels.push("Extra criteria");
  }
  const seedCount = filters.seedCompanies.split("\n").filter((s) => s.trim()).length;
  if (seedCount > 0) {
    labels.push(`${seedCount} seed ${seedCount === 1 ? "company" : "companies"}`);
  }
  if (filters.resultsView !== "all") {
    labels.push(filters.resultsView === "new" ? "New results only" : "Previously found only");
  }
  if (filters.scoreFilter !== "all") {
    const scoreLabels: Record<string, string> = {
      unscored: "Score: Unscored",
      high: "Score: High (8-10)",
      medium: "Score: Medium (5-7)",
      low: "Score: Low (0-4)",
    };
    labels.push(scoreLabels[filters.scoreFilter] ?? "Score filter");
  }

  return labels;
}

export function MspDashboard() {
  const defaultFilters = useMemo(() => getDefaultFilters(), []);

  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<DashboardFilters>(defaultFilters);
  const [rows, setRows] = useState<DashboardCompanyRow[]>([]);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const [runningSearch, setRunningSearch] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeFilterLabels = useMemo(
    () => getActiveFilterLabels(appliedFilters),
    [appliedFilters],
  );

  const displayedRows = useMemo(
    () => applyDisplayFilters(rows, lastRunId, appliedFilters.resultsView, appliedFilters.scoreFilter, appliedFilters.sizeTiers),
    [rows, lastRunId, appliedFilters.resultsView, appliedFilters.scoreFilter, appliedFilters.sizeTiers],
  );

  const scoredCount = useMemo(
    () => rows.filter((row) => row.score !== null).length,
    [rows],
  );
  const averageScore = useMemo(() => {
    const scoredRows = rows.filter((row) => row.score !== null);
    if (scoredRows.length === 0) {
      return null;
    }

    const sum = scoredRows.reduce((total, row) => total + (row.score ?? 0), 0);
    return (sum / scoredRows.length).toFixed(1);
  }, [rows]);

  const fetchRows = useCallback(async (currentFilters: DashboardFilters) => {
    setLoadingRows(true);
    setErrorMessage(null);

    try {
      const query = filtersToQuery(currentFilters);
      const response = await fetch(`/api/companies?${query}`, {
        method: "GET",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to fetch companies.");
      }

      const payload = (await response.json()) as DashboardCompanyRow[];
      setRows(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unknown error.");
    } finally {
      setLoadingRows(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows(appliedFilters);
  }, [appliedFilters, fetchRows]);

  const handleApplyFilters = useCallback(async () => {
    setAppliedFilters(filters);
    await fetchRows(filters);
  }, [fetchRows, filters]);

  // Display filters apply instantly without a DB fetch.
  const handleFiltersChange = useCallback((next: DashboardFilters) => {
    setFilters(next);
    const displayChanged =
      next.resultsView !== filters.resultsView ||
      next.scoreFilter !== filters.scoreFilter ||
      next.sizeTiers.join(",") !== filters.sizeTiers.join(",");
    if (displayChanged) {
      setAppliedFilters((prev) => ({
        ...prev,
        resultsView: next.resultsView,
        scoreFilter: next.scoreFilter,
        sizeTiers: next.sizeTiers,
      }));
    }
  }, [filters.resultsView, filters.scoreFilter, filters.sizeTiers]);

  const handleResetFilters = useCallback(() => {
    const reset = getDefaultFilters();
    setFilters(reset);
    setAppliedFilters(reset);
    setLastRunId(null);
  }, []);

  const handleRunSearch = useCallback(async () => {
    if (!filters.mustSupportAws && !filters.mustSupportAzure) {
      setErrorMessage("Please select at least one of 'Must support AWS' or 'Must support Azure' before running a search.");
      return;
    }

    // Always snapshot the current filter panel state before running so the
    // user doesn't need to click "Apply Filters" separately first.
    const currentFilters = filters;
    setAppliedFilters(currentFilters);
    setRunningSearch(true);
    setErrorMessage(null);
    setStatusMessage("Running bounded research pipeline...");

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: toApiFilters(currentFilters),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Search failed.");
      }

      const completedRunId = payload.runId as string | undefined;
      if (completedRunId) {
        setLastRunId(completedRunId);
      }

      setStatusMessage(
        `Search complete. Saved ${payload.persistedCount ?? 0} companies (verified: ${payload.verifiedCount ?? 0}, needs review: ${payload.needsReviewCount ?? 0}, rejected: ${payload.rejectedCount ?? 0}).`,
      );
      // Fetch results using only location filters so all saved companies are
      // visible regardless of cloud support confirmation status. Switch to
      // "new" view automatically so freshly found companies are highlighted.
      const displayFilters: DashboardFilters = {
        ...currentFilters,
        mustSupportAws: false,
        mustSupportAzure: false,
        resultsView: completedRunId ? "new" : "all",
        scoreFilter: "all",
        sizeTiers: [],
      };
      setAppliedFilters(displayFilters);
      setFilters(displayFilters);
      await fetchRows(displayFilters);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Search failed.");
      setStatusMessage(null);
    } finally {
      setRunningSearch(false);
    }
  }, [filters, fetchRows]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: toApiFilters(appliedFilters),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Export failed.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `msp-finder-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatusMessage("Excel export downloaded.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }, [appliedFilters]);

  const handleScoreUpdate = useCallback(async (id: string, score: number | null) => {
    await fetch(`/api/companies/${id}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score }),
    });
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, score } : row)),
    );
  }, []);


  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setErrorMessage(null);
    try {
      await fetchRows(appliedFilters);
      setStatusMessage("Results refreshed.");
    } catch {
      // fetchRows already sets error message
    } finally {
      setRefreshing(false);
    }
  }, [appliedFilters, fetchRows]);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            MSP Research Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Research leads, verify evidence, and score quality for outbound sales.
          </p>
        </div>
        <DashboardToolbar
          onRunSearch={handleRunSearch}
          onExport={handleExport}
          onRefresh={handleRefresh}
          isRunningSearch={runningSearch}
          isExporting={exporting}
          isRefreshing={refreshing}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h8" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Visible</p>
            <p className="text-2xl font-bold text-slate-900 leading-tight">
              {displayedRows.length}
              {displayedRows.length !== rows.length ? (
                <span className="text-base font-normal text-slate-400 ml-1">/ {rows.length}</span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Scored</p>
            <p className="text-2xl font-bold text-slate-900 leading-tight">{scoredCount}</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Avg Score</p>
            <p className="text-2xl font-bold text-slate-900 leading-tight">{averageScore ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* Status / error messages */}
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

      {/* Active filter chips */}
      {activeFilterLabels.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 font-medium mr-1">Filters:</span>
          {activeFilterLabels.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm"
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5 items-start">
        <FilterPanel
          filters={filters}
          onChange={handleFiltersChange}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
          busy={loadingRows || runningSearch || exporting || refreshing}
        />
        <ResultsTable
          rows={displayedRows}
          allRowsCount={rows.length}
          loading={loadingRows}
          lastRunId={lastRunId}
          onScoreUpdate={handleScoreUpdate}
        />
      </div>
    </div>
  );
}
