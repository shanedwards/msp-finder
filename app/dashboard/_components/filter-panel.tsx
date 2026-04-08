"use client";

import { FormField } from "@/components/form";
import { CompanySizeTier } from "@/lib/msp/types";
import { US_STATE_CODES } from "@/lib/msp/us-states";
import { DashboardFilters, ResultsAgeFilter, ScoreFilter } from "./types";

type FilterPanelProps = {
  filters: DashboardFilters;
  onChange: (next: DashboardFilters) => void;
  onApply: () => Promise<void>;
  onReset: () => void;
  busy: boolean;
};

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
      {children}
    </p>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; activeClass?: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-slate-200 text-xs">
      {options.map((opt, i) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={[
            "flex-1 px-2 py-1.5 font-medium transition-colors",
            i > 0 ? "border-l border-slate-200" : "",
            value === opt.id
              ? (opt.activeClass ?? "bg-blue-600 text-white")
              : "bg-white text-slate-600 hover:bg-slate-50",
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function toggleArrayValue(values: string[], value: string): string[] {
  if (values.includes(value)) {
    return values.filter((item) => item !== value);
  }
  return [...values, value];
}

export function FilterPanel({ filters, onChange, onApply, onReset, busy }: FilterPanelProps) {
  return (
    <aside className="bg-white border border-slate-200 rounded-xl shadow-sm lg:sticky lg:top-20 h-fit overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-800 mr-auto">Filters</h2>
        <button
          type="button"
          disabled={busy}
          onClick={onReset}
          className="text-xs font-medium text-slate-400 hover:text-slate-700 disabled:opacity-50 transition-colors px-1"
        >
          Reset
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onApply()}
          className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
        >
          Apply Filters
        </button>
      </div>

      <div className="p-4 space-y-5 overflow-y-auto max-h-[calc(100vh-9rem)]">

        {/* States */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <SectionHeader>State</SectionHeader>
            {filters.states.length > 0 ? (
              <button
                type="button"
                className="text-[10px] text-blue-600 hover:text-blue-800 font-medium"
                onClick={() => onChange({ ...filters, states: [] })}
              >
                Clear
              </button>
            ) : null}
          </div>
          <div className="h-36 overflow-auto border border-slate-200 rounded-lg p-2 grid grid-cols-2 gap-x-2 gap-y-0.5 bg-slate-50/50">
            {US_STATE_CODES.map((state) => (
              <label key={state} className="text-xs flex items-center gap-1.5 py-0.5 cursor-pointer hover:text-blue-700">
                <input
                  type="checkbox"
                  checked={filters.states.includes(state)}
                  onChange={() => onChange({ ...filters, states: toggleArrayValue(filters.states, state) })}
                  className="accent-blue-600 w-3 h-3 flex-shrink-0"
                />
                {state}
              </label>
            ))}
          </div>
          {filters.states.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {filters.states.map((state) => (
                <button
                  key={state}
                  type="button"
                  onClick={() => onChange({ ...filters, states: filters.states.filter((s) => s !== state) })}
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                >
                  {state}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        {/* Location */}
        <section className="space-y-3 border-t border-slate-100 pt-4">
          <SectionHeader>Location</SectionHeader>
          <FormField
            label="City"
            id="city"
            value={filters.city}
            placeholder="Optional city"
            onChange={(e) => onChange({ ...filters, city: e.target.value })}
          />
          <FormField
            label="Search Limit (AI)"
            id="resultLimit"
            type="number"
            min={1}
            max={20}
            value={filters.resultLimit}
            onChange={(e) => onChange({ ...filters, resultLimit: e.target.value })}
          />
        </section>

        {/* Capabilities */}
        <section className="space-y-2.5 border-t border-slate-100 pt-4">
          <SectionHeader>Capabilities &amp; Evidence</SectionHeader>
          {[
            { key: "mustSupportAws" as const, label: "Must support AWS" },
            { key: "mustSupportAzure" as const, label: "Must support Azure" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-700 group">
              <input
                type="checkbox"
                checked={filters[key]}
                onChange={(e) => onChange({ ...filters, [key]: e.target.checked })}
                className="accent-blue-600 w-3.5 h-3.5 flex-shrink-0"
              />
              <span className="text-slate-700 group-hover:text-blue-700 leading-snug">{label}</span>
            </label>
          ))}
        </section>

        {/* Extra Criteria */}
        <section className="border-t border-slate-100 pt-4">
          <FormField
            label="Extra Criteria"
            id="extraCriteria"
            value={filters.extraCriteria}
            placeholder="Optional plain-text guidance for the AI"
            onChange={(e) => onChange({ ...filters, extraCriteria: e.target.value })}
          />
        </section>

        {/* Seed Companies */}
        <section className="border-t border-slate-100 pt-4 space-y-2">
          <div>
            <SectionHeader>Seed Companies</SectionHeader>
            <p className="text-[10px] text-slate-400 mt-1 leading-snug">
              Enter known company names (one per line) to force the AI to research them directly.
            </p>
          </div>
          <textarea
            id="seedCompanies"
            rows={4}
            value={filters.seedCompanies}
            onChange={(e) => onChange({ ...filters, seedCompanies: e.target.value })}
            placeholder={"Lightstream\nnClouds\nCloudticity"}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 resize-none leading-relaxed"
          />
          {filters.seedCompanies.split("\n").filter((s) => s.trim()).length > 0 ? (
            <p className="text-[10px] text-blue-600 font-medium">
              {filters.seedCompanies.split("\n").filter((s) => s.trim()).length} compan
              {filters.seedCompanies.split("\n").filter((s) => s.trim()).length === 1 ? "y" : "ies"} will be seeded
            </p>
          ) : null}
        </section>

        {/* Display filters */}
        <section className="space-y-3 border-t border-slate-100 pt-4">
          <SectionHeader>Display</SectionHeader>
          <div className="space-y-1.5">
            <p className="text-xs text-slate-500">Results age</p>
            <SegmentedControl<ResultsAgeFilter>
              value={filters.resultsView}
              onChange={(next) => onChange({ ...filters, resultsView: next })}
              options={[
                { id: "all", label: "All" },
                { id: "new", label: "New" },
                { id: "old", label: "Old" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-slate-500">Score tier</p>
            <SegmentedControl<ScoreFilter>
              value={filters.scoreFilter}
              onChange={(next) => onChange({ ...filters, scoreFilter: next })}
              options={[
                { id: "all", label: "All" },
                { id: "unscored", label: "—" },
                { id: "high", label: "High", activeClass: "bg-green-600 text-white" },
                { id: "medium", label: "Med", activeClass: "bg-amber-500 text-white" },
                { id: "low", label: "Low", activeClass: "bg-red-500 text-white" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Company size</p>
              {filters.sizeTiers.length > 0 ? (
                <button
                  type="button"
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-medium"
                  onClick={() => onChange({ ...filters, sizeTiers: [] })}
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {(
                [
                  { id: "micro" as CompanySizeTier, label: "Micro", sub: "1–10" },
                  { id: "small" as CompanySizeTier, label: "Small", sub: "11–75" },
                  { id: "mid"   as CompanySizeTier, label: "Mid",   sub: "76–300" },
                  { id: "large" as CompanySizeTier, label: "Large", sub: "300+" },
                ]
              ).map(({ id, label, sub }) => (
                <label key={id} className="flex items-center gap-1.5 text-xs cursor-pointer hover:text-blue-700 group py-0.5">
                  <input
                    type="checkbox"
                    checked={filters.sizeTiers.includes(id)}
                    onChange={() => {
                      const next = filters.sizeTiers.includes(id)
                        ? filters.sizeTiers.filter((t) => t !== id)
                        : [...filters.sizeTiers, id];
                      onChange({ ...filters, sizeTiers: next });
                    }}
                    className="accent-blue-600 w-3 h-3 flex-shrink-0"
                  />
                  <span className="text-slate-700 group-hover:text-blue-700">
                    {label}
                    <span className="text-slate-400 text-[10px] ml-1">({sub})</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 leading-snug">
              Unchecked = show all. Unknown-size companies are hidden when a size is selected.
            </p>
          </div>
        </section>
      </div>
    </aside>
  );
}
