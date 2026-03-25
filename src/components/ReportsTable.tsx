import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPatients } from '../services/crfService';
import type { PatientRecord } from '../services/crfService';
import { Loader2, FileText, RefreshCw, Filter, X } from 'lucide-react';

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
      default:
        break;
    }
  }
  return true;
}

function getNestedValue(obj: Record<string, any>, key: string): unknown {
  if (key in obj) return obj[key];
  if (obj.data && key in obj.data) return obj.data[key];
  return undefined;
}

function applyFilter(records: PatientRecord[], query: Record<string, any>): PatientRecord[] {
  return records.filter((record) => {
    for (const [key, condition] of Object.entries(query)) {
      if (key === '$and' && Array.isArray(condition)) {
        if (!condition.every((sub) => applyFilter([record], sub).length > 0)) return false;
        continue;
      }
      if (key === '$or' && Array.isArray(condition)) {
        if (!condition.some((sub) => applyFilter([record], sub).length > 0)) return false;
        continue;
      }

      const fieldValue = getNestedValue(record as Record<string, any>, key);

      if (condition !== null && typeof condition === 'object' && !Array.isArray(condition)) {
        if (!matchesOperator(fieldValue, condition as MongoOperator)) return false;
      } else {
        // Plain equality (case-insensitive for strings)
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
// Derive visible columns from data
// ---------------------------------------------------------------------------

function deriveColumns(records: PatientRecord[]): string[] {
  const priorityCols = ['crh_number', 'created_at'];
  const dataKeys = new Set<string>();

  for (const r of records.slice(0, 100)) {
    if (r.data && typeof r.data === 'object') {
      Object.keys(r.data).forEach((k) => dataKeys.add(k));
    }
  }

  const extra = Array.from(dataKeys).filter((k) => !priorityCols.includes(k));
  return [...priorityCols, ...extra];
}

function getCellValue(record: PatientRecord, col: string): string {
  if (col === 'crh_number') return record.crh_number ?? '—';
  if (col === 'created_at') {
    const raw = record.created_at;
    if (!raw) return '—';
    try { return new Date(raw).toLocaleDateString(); } catch { return raw; }
  }
  const val = record.data?.[col];
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function formatHeader(col: string): string {
  return col
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ReportsTable: React.FC = () => {
  const [filterInput, setFilterInput] = useState('');
  const [appliedFilter, setAppliedFilter] = useState<Record<string, any>>({});
  const [filterError, setFilterError] = useState<string | null>(null);

  const { data: patients, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['patients'],
    queryFn: getPatients,
  });

  const handleApplyFilter = () => {
    const trimmed = filterInput.trim();
    if (!trimmed) {
      setAppliedFilter({});
      setFilterError(null);
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        setFilterError('Filter must be a JSON object, e.g. {"crh_number": "12345"}');
        return;
      }
      setAppliedFilter(parsed);
      setFilterError(null);
    } catch {
      setFilterError('Invalid JSON. Please enter a valid MongoDB-style query.');
    }
  };

  const handleClearFilter = () => {
    setFilterInput('');
    setAppliedFilter({});
    setFilterError(null);
  };

  const filtered = useMemo(() => {
    if (!patients) return [];
    if (Object.keys(appliedFilter).length === 0) return patients;
    return applyFilter(patients, appliedFilter);
  }, [patients, appliedFilter]);

  const columns = useMemo(() => deriveColumns(filtered.length > 0 ? filtered : (patients ?? [])), [filtered, patients]);

  // ---- Render ----

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
        <p className="text-red-700 text-sm mt-1">
          {(error as Error)?.message ?? 'Unknown error'}
        </p>
        <button
          onClick={() => refetch()}
          className="mt-4 bg-red-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-red-700 transition-colors"
        >
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

      {/* Filter bar */}
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
          <button
            onClick={handleApplyFilter}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Apply
          </button>
          {(filterInput || Object.keys(appliedFilter).length > 0) && (
            <button
              onClick={handleClearFilter}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg border border-gray-200 text-sm transition-colors"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
        {filterError && (
          <p className="text-red-600 text-xs">{filterError}</p>
        )}
        {Object.keys(appliedFilter).length > 0 && !filterError && (
          <p className="text-blue-600 text-xs">
            Filter active: <span className="font-mono">{JSON.stringify(appliedFilter)}</span>
          </p>
        )}
      </div>

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
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap"
                  >
                    {formatHeader(col)}
                  </th>
                ))}
                {/* PDF button column */}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  CR
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.map((record, idx) => (
                <tr key={record.id ?? record.crh_number ?? idx} className="hover:bg-gray-50 transition-colors">
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="px-4 py-2.5 text-gray-700 whitespace-nowrap max-w-[200px] truncate"
                      title={getCellValue(record, col)}
                    >
                      {getCellValue(record, col)}
                    </td>
                  ))}
                  <td className="px-4 py-2.5">
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
    </div>
  );
};
