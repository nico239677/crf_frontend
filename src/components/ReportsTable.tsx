import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPatients } from '../services/crfService';
import type { PatientRecord } from '../services/crfService';
import { Loader2, FileText, RefreshCw, Filter, X, Download, ChevronDown } from 'lucide-react';

// ---------------------------------------------------------------------------
// MongoDB-style client-side filter
// ---------------------------------------------------------------------------

type MongoValue = string | number | boolean | null | MongoValue[];
type MongoOperator = Record<string, MongoValue>;

function matchesOperator(fieldValue: unknown, operator: MongoOperator): boolean {
  for (const [op, opVal] of Object.entries(operator)) {
    const fv = fieldValue as any;
    switch (op) {
      case '$eq':   if (fv != opVal) return false; break;
      case '$ne':   if (fv == opVal) return false; break;
      case '$gt':   if (!(fv > (opVal as number))) return false; break;
      case '$gte':  if (!(fv >= (opVal as number))) return false; break;
      case '$lt':   if (!(fv < (opVal as number))) return false; break;
      case '$lte':  if (!(fv <= (opVal as number))) return false; break;
      case '$in':   if (!Array.isArray(opVal) || !opVal.includes(fv)) return false; break;
      case '$nin':  if (!Array.isArray(opVal) || opVal.includes(fv)) return false; break;
      case '$regex': {
        const re = new RegExp(opVal as string, 'i');
        if (!re.test(String(fv ?? ''))) return false;
        break;
      }
      case '$exists':
        if (opVal && fieldValue === undefined) return false;
        if (!opVal && fieldValue !== undefined) return false;
        break;
      default: break;
    }
  }
  return true;
}

function getNestedValue(obj: Record<string, any>, key: string): unknown {
  if (key in obj) return obj[key];
  if (obj.data && key in obj.data) return obj.data[key];
  return undefined;
}

function applyMongoFilter(records: PatientRecord[], query: Record<string, any>): PatientRecord[] {
  return records.filter((record) => {
    for (const [key, condition] of Object.entries(query)) {
      if (key === '$and' && Array.isArray(condition)) {
        if (!condition.every((sub) => applyMongoFilter([record], sub).length > 0)) return false;
        continue;
      }
      if (key === '$or' && Array.isArray(condition)) {
        if (!condition.some((sub) => applyMongoFilter([record], sub).length > 0)) return false;
        continue;
      }
      const fieldValue = getNestedValue(record as Record<string, any>, key);
      if (condition !== null && typeof condition === 'object' && !Array.isArray(condition)) {
        if (!matchesOperator(fieldValue, condition as MongoOperator)) return false;
      } else {
        if (typeof fieldValue === 'string' && typeof condition === 'string') {
          if (fieldValue.toLowerCase() !== condition.toLowerCase()) return false;
        } else {
          if (fieldValue != condition) return false;
        }
      }
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Column filters
// ---------------------------------------------------------------------------

type ColFilterCategorical = { type: 'categorical'; selected: Set<string> };
type ColFilterNumeric = { type: 'numeric'; min: string; max: string };
type ColFilterDate = { type: 'date'; min: string; max: string };
type ColFilterState = ColFilterCategorical | ColFilterNumeric | ColFilterDate;

const DATE_COL_PATTERNS = /date|_at$/i;

function isDateString(v: unknown): boolean {
  if (typeof v !== 'string' || v.length < 8) return false;
  const d = new Date(v);
  return !isNaN(d.getTime());
}

function detectColType(records: PatientRecord[], col: string): 'numeric' | 'categorical' | 'date' {
  if (DATE_COL_PATTERNS.test(col)) return 'date';
  const vals = records.map((r) => (r as Record<string, any>)[col]).filter((v) => v !== null && v !== undefined && v !== '');
  if (vals.length === 0) return 'categorical';
  // Binary columns → categorical
  const unique = new Set(vals.map(String));
  if (unique.size <= 2) return 'categorical';
  // Date-like strings → date
  const dateCount = vals.filter(isDateString).length;
  if (dateCount / vals.length > 0.6) return 'date';
  // Numeric
  const numericCount = vals.filter((v) => typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)))).length;
  return numericCount / vals.length > 0.6 ? 'numeric' : 'categorical';
}

function getUniqueValues(records: PatientRecord[], col: string): string[] {
  const seen = new Set<string>();
  let hasEmpty = false;
  for (const r of records) {
    const raw = (r as Record<string, any>)[col];
    if (raw === null || raw === undefined || raw === '') {
      hasEmpty = true;
    } else {
      seen.add(String(raw));
    }
  }
  const sorted = Array.from(seen).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (hasEmpty) sorted.push('');
  return sorted;
}

function applyColFilters(records: PatientRecord[], filters: Record<string, ColFilterState>): PatientRecord[] {
  return records.filter((record) => {
    for (const [col, filter] of Object.entries(filters)) {
      const raw = (record as Record<string, any>)[col];
      if (filter.type === 'categorical') {
        if (filter.selected.size === 0) continue;
        const val = raw === null || raw === undefined ? '' : String(raw);
        if (!filter.selected.has(val)) return false;
      } else if (filter.type === 'numeric') {
        const num = typeof raw === 'number' ? raw : Number(raw);
        if (filter.min !== '' && !isNaN(Number(filter.min)) && num < Number(filter.min)) return false;
        if (filter.max !== '' && !isNaN(Number(filter.max)) && num > Number(filter.max)) return false;
      } else {
        const d = new Date(raw);
        if (isNaN(d.getTime())) continue;
        if (filter.min !== '') { const lo = new Date(filter.min); if (!isNaN(lo.getTime()) && d < lo) return false; }
        if (filter.max !== '') { const hi = new Date(filter.max); if (!isNaN(hi.getTime()) && d > hi) return false; }
      }
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EXCLUDED_COLS = new Set(['data', 'id']);

function deriveColumns(records: PatientRecord[]): string[] {
  const keys = new Set<string>();
  for (const r of records.slice(0, 100)) {
    Object.keys(r).forEach((k) => { if (!EXCLUDED_COLS.has(k)) keys.add(k); });
  }
  return Array.from(keys);
}

function getCellValue(record: PatientRecord, col: string): string {
  const val = (record as Record<string, any>)[col];
  if (val === null || val === undefined) return '—';
  if (col === 'created_at') {
    try { return new Date(val).toLocaleDateString(); } catch { return String(val); }
  }
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function formatHeader(col: string): string {
  return col.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function downloadCSV(records: PatientRecord[], columns: string[]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = columns.map(escape).join(',');
  const rows = records.map((r) => columns.map((col) => escape(getCellValue(r, col))).join(','));
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'patients.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Column filter popover
// ---------------------------------------------------------------------------

interface ColFilterPopoverProps {
  col: string;
  records: PatientRecord[];
  filter: ColFilterState | undefined;
  anchor: { x: number; y: number };
  onClose: () => void;
  onChange: (col: string, filter: ColFilterState | null) => void;
}

const ColFilterPopover: React.FC<ColFilterPopoverProps> = ({ col, records, filter, anchor, onClose, onChange }) => {
  const ref = useRef<HTMLDivElement>(null);
  const colType = useMemo(() => detectColType(records, col), [records, col]);
  const uniqueValues = useMemo(() => colType === 'categorical' ? getUniqueValues(records, col) : [], [records, col, colType]);
  const [search, setSearch] = useState('');

  const categoricalSelected: Set<string> = filter?.type === 'categorical' ? filter.selected : new Set();
  const numMin = filter?.type === 'numeric' ? filter.min : '';
  const numMax = filter?.type === 'numeric' ? filter.max : '';
  const dateMin = filter?.type === 'date' ? filter.min : '';
  const dateMax = filter?.type === 'date' ? filter.max : '';

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const toggleValue = (val: string) => {
    const next = new Set(categoricalSelected);
    if (next.has(val)) next.delete(val); else next.add(val);
    onChange(col, { type: 'categorical', selected: next });
  };

  const setNumeric = (min: string, max: string) => {
    onChange(col, { type: 'numeric', min, max });
  };

  const setDate = (min: string, max: string) => {
    onChange(col, { type: 'date', min, max });
  };

  const filteredValues = uniqueValues.filter((v) => v.toLowerCase().includes(search.toLowerCase()));

  // Clamp popover to viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(anchor.y, window.innerHeight - 320),
    left: Math.min(anchor.x, window.innerWidth - 280),
    zIndex: 50,
    width: 260,
  };

  return (
    <div ref={ref} style={style} className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{formatHeader(col)}</span>
        <div className="flex gap-1">
          {filter && (
            <button onClick={() => onChange(col, null)} className="text-xs text-red-500 hover:text-red-700 px-1">
              Clear
            </button>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {colType === 'categorical' ? (
        <>
          {uniqueValues.length > 8 && (
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search values…"
              className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          )}
          <div className="max-h-52 overflow-y-auto space-y-1">
            {filteredValues.length === 0 ? (
              <p className="text-xs text-gray-400 py-1">No values</p>
            ) : (
              filteredValues.map((val) => (
                <label key={val} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                  <input
                    type="checkbox"
                    checked={categoricalSelected.has(val)}
                    onChange={() => toggleValue(val)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                  />
                  <span className={`truncate ${val === '' ? 'italic text-gray-400' : ''}`} title={val || 'Not defined'}>{val || 'Not defined'}</span>
                </label>
              ))
            )}
          </div>
          {categoricalSelected.size > 0 && (
            <p className="text-xs text-blue-600">{categoricalSelected.size} selected</p>
          )}
        </>
      ) : colType === 'numeric' ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-8">Min</label>
            <input
              type="number"
              value={numMin}
              onChange={(e) => setNumeric(e.target.value, numMax)}
              placeholder="—"
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-8">Max</label>
            <input
              type="number"
              value={numMax}
              onChange={(e) => setNumeric(numMin, e.target.value)}
              placeholder="—"
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-8">From</label>
            <input
              type="date"
              value={dateMin}
              onChange={(e) => setDate(e.target.value, dateMax)}
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-8">To</label>
            <input
              type="date"
              value={dateMax}
              onChange={(e) => setDate(dateMin, e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

export const ReportsTable: React.FC = () => {
  const [filterInput, setFilterInput] = useState('');
  const [appliedFilter, setAppliedFilter] = useState<Record<string, any>>({});
  const [filterError, setFilterError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [columnFilters, setColumnFilters] = useState<Record<string, ColFilterState>>({});
  const [activeFilterCol, setActiveFilterCol] = useState<string | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<{ x: number; y: number } | null>(null);

  const { data: patients, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['patients'],
    queryFn: getPatients,
    staleTime: Infinity,
  });

  const handleApplyFilter = () => {
    const trimmed = filterInput.trim();
    if (!trimmed) { setAppliedFilter({}); setFilterError(null); return; }
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        setFilterError('Filter must be a JSON object, e.g. {"crh_number": "12345"}');
        return;
      }
      setAppliedFilter(parsed);
      setFilterError(null);
      setPage(0);
    } catch {
      setFilterError('Invalid JSON. Please enter a valid MongoDB-style query.');
    }
  };

  const handleClearFilter = () => {
    setFilterInput('');
    setAppliedFilter({});
    setFilterError(null);
    setPage(0);
  };

  const openColFilter = (col: string, e: React.MouseEvent<Element>) => {
    if (activeFilterCol === col) { setActiveFilterCol(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setPopoverAnchor({ x: rect.left, y: rect.bottom + 4 });
    setActiveFilterCol(col);
  };

  const handleColFilterChange = (col: string, filter: ColFilterState | null) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (!filter || (filter.type === 'categorical' && filter.selected.size === 0) ||
          (filter.type !== 'categorical' && filter.min === '' && filter.max === '')) {
        delete next[col];
      } else {
        next[col] = filter;
      }
      return next;
    });
    setPage(0);
  };

  const mongoFiltered = useMemo(() => {
    if (!patients) return [];
    if (Object.keys(appliedFilter).length === 0) return patients;
    return applyMongoFilter(patients, appliedFilter);
  }, [patients, appliedFilter]);

  const filtered = useMemo(() => {
    if (Object.keys(columnFilters).length === 0) return mongoFiltered;
    return applyColFilters(mongoFiltered, columnFilters);
  }, [mongoFiltered, columnFilters]);

  const columns = useMemo(() => deriveColumns(patients ?? []), [patients]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const activeColFilterCount = Object.keys(columnFilters).length;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-gray-600 text-sm">Loading patients…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-800 font-semibold">Failed to load patients</p>
        <p className="text-red-700 text-sm mt-1">{(error as Error)?.message ?? 'Unknown error'}</p>
        <button onClick={() => refetch()} className="mt-4 bg-red-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-red-700 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Reports</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} / {patients?.length ?? 0} records
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* MongoDB filter bar — hidden for now
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={filterInput}
              onChange={(e) => setFilterInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilter()}
              placeholder='MongoDB-style filter, e.g. {"crh_number": "123"} or {"age": {"$gte": 30}}'
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:font-sans"
            />
          </div>
          <button onClick={handleApplyFilter} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            Apply
          </button>
          {(filterInput || Object.keys(appliedFilter).length > 0) && (
            <button onClick={handleClearFilter} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg border border-gray-200 text-sm transition-colors">
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
        {filterError && <p className="text-red-600 text-xs">{filterError}</p>}
        {Object.keys(appliedFilter).length > 0 && !filterError && (
          <p className="text-blue-600 text-xs">Filter active: <span className="font-mono">{JSON.stringify(appliedFilter)}</span></p>
        )}
      </div>
      */}

      {/* Active filter chips */}
      {activeColFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(columnFilters).map(([col, filter]) => {
            const summary =
              filter.type === 'categorical'
                ? Array.from(filter.selected).map((v) => v || 'Not defined').join(', ')
                : filter.type === 'numeric'
                ? [filter.min && `≥ ${filter.min}`, filter.max && `≤ ${filter.max}`].filter(Boolean).join(' · ')
                : [filter.min && `from ${filter.min}`, filter.max && `to ${filter.max}`].filter(Boolean).join(' · ');
            return (
              <button
                key={col}
                onClick={(e) => openColFilter(col, e)}
                className="relative flex items-center gap-1.5 pl-3 pr-7 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700 hover:bg-blue-100 transition-colors"
                title={`${formatHeader(col)}: ${summary}`}
              >
                <span className="font-semibold">{formatHeader(col)}</span>
                <span className="text-blue-500 max-w-[160px] truncate">{summary}</span>
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); handleColFilterChange(col, null); }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-700 rounded-full hover:bg-blue-200 p-0.5 transition-colors"
                  title={`Remove filter on ${formatHeader(col)}`}
                >
                  <X className="w-3 h-3" />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm border border-dashed border-gray-200 rounded-lg">
          No records match the current filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((col) => {
                  const hasFilter = col in columnFilters;
                  return (
                    <th key={col} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span className={hasFilter ? 'text-blue-600' : 'text-gray-600'}>{formatHeader(col)}</span>
                        <button
                          onClick={(e) => openColFilter(col, e)}
                          className={`rounded p-0.5 transition-colors ${hasFilter ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}
                          title={hasFilter ? 'Filter active — click to edit' : 'Filter this column'}
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                  );
                })}
                <th className="sticky right-0 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  CR
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {pageRows.map((record, idx) => (
                <tr key={record.id ?? record.crh_number ?? idx} className="hover:bg-gray-50 transition-colors">
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-2.5 text-gray-700 whitespace-nowrap max-w-[200px] truncate" title={getCellValue(record, col)}>
                      {getCellValue(record, col)}
                    </td>
                  ))}
                  <td className="sticky right-0 bg-white px-4 py-2.5 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                    <button
                      disabled
                      title="PDF access not yet configured"
                      className="flex items-center gap-1.5 text-xs text-gray-400 border border-gray-200 rounded px-2 py-1 cursor-not-allowed opacity-60"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Open PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination + Download */}
      <div className="flex items-center justify-between pt-2 text-sm text-gray-600">
        <div className="flex items-center gap-4">
          {totalPages > 1 && (
            <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          )}
          <button
            onClick={() => downloadCSV(filtered, columns)}
            className="flex items-center gap-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => p - 1)} disabled={page === 0} className="px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Previous
            </button>
            <span className="text-xs text-gray-500">Page {page + 1} / {totalPages}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1} className="px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Next
            </button>
          </div>
        )}
      </div>

      {/* Column filter popover */}
      {activeFilterCol && popoverAnchor && (
        <ColFilterPopover
          col={activeFilterCol}
          records={patients ?? []}
          filter={columnFilters[activeFilterCol]}
          anchor={popoverAnchor}
          onClose={() => setActiveFilterCol(null)}
          onChange={handleColFilterChange}
        />
      )}
    </div>
  );
};
