"use client";

type DashboardToolbarProps = {
  onRunSearch: () => Promise<void>;
  onExport: () => Promise<void>;
  onRefresh: () => Promise<void>;
  isRunningSearch: boolean;
  isExporting: boolean;
  isRefreshing: boolean;
};

function Spinner() {
  return (
    <svg
      className="animate-spin h-3.5 w-3.5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function DashboardToolbar(props: DashboardToolbarProps) {
  const { onRunSearch, onExport, onRefresh, isRunningSearch, isExporting, isRefreshing } = props;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void onRunSearch()}
        disabled={isRunningSearch}
        className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
      >
        {isRunningSearch ? (
          <>
            <Spinner />
            Running…
          </>
        ) : (
          <>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            Run Search
          </>
        )}
      </button>

      <button
        type="button"
        onClick={() => void onExport()}
        disabled={isExporting}
        className="inline-flex items-center gap-2 border border-slate-300 bg-white text-slate-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
      >
        {isExporting ? (
          <>
            <Spinner />
            Exporting…
          </>
        ) : (
          <>
            <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 8-3-3m3 3 3-3M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
            </svg>
            Export to Excel
          </>
        )}
      </button>

      <button
        type="button"
        onClick={() => void onRefresh()}
        disabled={isRefreshing}
        className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
      >
        {isRefreshing ? (
          <>
            <Spinner />
            Refreshing…
          </>
        ) : (
          <>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4.07 19a9 9 0 0 0 15.28-4M20 5a9 9 0 0 0-15.28 4" />
            </svg>
            Refresh
          </>
        )}
      </button>
    </div>
  );
}
