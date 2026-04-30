import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileUpload } from '../components/FileUpload';
import { AnalysisResults } from '../components/AnalysisResults';
import { Chat } from '../components/Chat';
import { ReportsTable } from '../components/ReportsTable';
import { SchemaEditor } from '../components/SchemaEditor';
import { analyzeCRF, bulkPreview, bulkConfirm } from '../services/crfService';
import type { PreviewRecord, BulkUploadResponse } from '../services/crfService';
import type { AnalysisResponse } from '../types/crf';
import { useChatHistory } from '../hooks/useChatHistory';
import type { Conversation } from '../hooks/useChatHistory';
import {
  Loader2, Activity, FileSearch, MessageSquare,
  Upload, Database, Settings2, LogOut, ChevronDown, X, Plus, MessageCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type PrimaryMode = 'analysis' | 'chat';
type ToolPanel = 'bulk' | 'reports' | 'schema' | null;

interface HomeProps {
  onSignOut?: () => void;
  userEmail?: string;
}

// ─── Tools dropdown ───────────────────────────────────────────────────────────

const TOOLS = [
  { id: 'bulk'    as const, icon: Upload,   label: 'Bulk CR Upload',  desc: 'Add multiple CRs at once' },
  { id: 'reports' as const, icon: Database, label: 'Reports',         desc: 'Browse & export table data' },
  { id: 'schema'  as const, icon: Settings2,label: 'Schema Editor',   desc: 'Manage extraction columns' },
];

interface ToolsDropdownProps {
  onSelect: (tool: ToolPanel) => void;
}

const ToolsDropdown: React.FC<ToolsDropdownProps> = ({ onSelect }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 transition-colors ${
          open ? 'bg-gray-100 text-gray-900' : 'bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        <Settings2 className="w-4 h-4" />
        Tools
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-56 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5">
          <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            Secondary tools
          </p>
          {TOOLS.map(({ id, icon: Icon, label, desc }) => (
            <button
              key={id}
              onClick={() => { onSelect(id); setOpen(false); }}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 transition-colors"
            >
              <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-gray-500" />
              </span>
              <span>
                <div className="text-sm font-semibold text-gray-900">{label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{desc}</div>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Slide-over panel ─────────────────────────────────────────────────────────

interface SlidePanelProps {
  tool: NonNullable<ToolPanel>;
  onClose: () => void;
  children: React.ReactNode;
}

const SlidePanel: React.FC<SlidePanelProps> = ({ tool, onClose, children }) => {
  const meta = TOOLS.find(t => t.id === tool)!;
  const Icon = meta.icon;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/25 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div className="w-[62vw] max-w-3xl bg-white h-full shadow-2xl flex flex-col animate-slide-in">
        {/* Panel header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <Icon className="w-4 h-4 text-gray-600" />
            </span>
            <span className="text-base font-bold text-gray-900 tracking-tight">{meta.label}</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Panel body */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// ─── Mode switcher ────────────────────────────────────────────────────────────

interface ModeSwitcherProps {
  mode: PrimaryMode;
  onSelect: (m: PrimaryMode) => void;
}

const MODES: { id: PrimaryMode; icon: React.FC<any>; label: string; desc: string; activeColor: string; activeBg: string; activeBorder: string }[] = [
  {
    id: 'analysis',
    icon: FileSearch,
    label: 'Analyze CR',
    desc: 'Upload a Case Report Form, extract patient data with AI, and save to the database.',
    activeColor: 'text-blue-600',
    activeBg: 'bg-blue-50',
    activeBorder: 'border-blue-600',
  },
  {
    id: 'chat',
    icon: MessageSquare,
    label: 'Chat with Data',
    desc: 'Ask questions about your patient records, prescription patterns, and similar cases.',
    activeColor: 'text-violet-600',
    activeBg: 'bg-violet-50',
    activeBorder: 'border-violet-600',
  },
];

const ModeSwitcher: React.FC<ModeSwitcherProps> = ({ mode, onSelect }) => (
  <div className="grid grid-cols-2 gap-3 mb-7">
    {MODES.map(({ id, icon: Icon, label, desc, activeColor, activeBg, activeBorder }) => {
      const active = mode === id;
      return (
        <button
          key={id}
          onClick={() => onSelect(id)}
          className={`flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all ${
            active
              ? `${activeBorder} ${activeBg}`
              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
            active ? (id === 'analysis' ? 'bg-blue-600' : 'bg-violet-600') : 'bg-gray-100'
          }`}>
            <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-400'}`} />
          </span>
          <span>
            <div className={`text-base font-bold mb-1 tracking-tight ${active ? activeColor : 'text-gray-900'}`}>
              {label}
            </div>
            <div className="text-sm text-gray-400 leading-relaxed">{desc}</div>
          </span>
        </button>
      );
    })}
  </div>
);

// ─── Chat history helpers ──────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dayBucket(ts: number): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const d = new Date(ts);
  const bucket = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (bucket === today) return 'Today';
  if (bucket === today - 86400000) return 'Yesterday';
  if (today - bucket < 7 * 86400000) return 'This week';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

interface ConvItemProps {
  conv: Conversation;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const ConvItem: React.FC<ConvItemProps> = ({ conv, active, onSelect, onDelete }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative mx-2 mb-0.5 rounded-lg cursor-pointer transition-all ${
        active
          ? 'bg-white shadow-sm border border-gray-200'
          : 'hover:bg-white/60'
      }`}
    >
      <div className={`pl-3 pr-7 py-2.5 border-l-2 rounded-l-sm transition-colors ${
        active ? 'border-blue-500' : 'border-transparent'
      }`}>
        <p className="text-xs font-medium text-gray-700 truncate leading-tight">{conv.title}</p>
        <p className="text-[10px] text-gray-400 mt-0.5 tabular-nums">{relativeTime(conv.updatedAt)}</p>
      </div>
      {hovered && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

interface ChatSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ conversations, activeId, onSelect, onDelete, onNew }) => {
  // Group by day bucket
  const groups: { label: string; items: Conversation[] }[] = [];
  for (const conv of conversations) {
    const label = dayBucket(conv.updatedAt);
    const g = groups.find(g => g.label === label);
    if (g) g.items.push(conv);
    else groups.push({ label, items: [conv] });
  }

  return (
    <div className="w-52 flex-shrink-0 border-r border-gray-100 flex flex-col bg-gray-50/60">
      <div className="p-2.5 border-b border-gray-100">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 space-y-3">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-10 px-4 text-center">
            <MessageCircle className="w-7 h-7 text-gray-200 mb-2" />
            <p className="text-[11px] text-gray-400">No conversations yet</p>
          </div>
        ) : (
          groups.map(({ label, items }) => (
            <div key={label}>
              <p className="px-4 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
              {items.map(conv => (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  active={conv.id === activeId}
                  onSelect={() => onSelect(conv.id)}
                  onDelete={() => onDelete(conv.id)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ─── Home ─────────────────────────────────────────────────────────────────────

export const Home: React.FC<HomeProps> = ({ onSignOut, userEmail }) => {
  const [primaryMode, setPrimaryMode] = useState<PrimaryMode>('analysis');
  const [activeTool, setActiveTool] = useState<ToolPanel>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  // Analysis state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResponse | null>(null);

  // Bulk state
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkDragOver, setBulkDragOver] = useState(false);
  const [bulkPreviewRecords, setBulkPreviewRecords] = useState<PreviewRecord[]>([]);
  const [bulkPreviewErrors, setBulkPreviewErrors] = useState<{ crh_number: string | null; error: string }[]>([]);
  const [bulkConfirmResult, setBulkConfirmResult] = useState<BulkUploadResponse | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);

  // Chat state — persisted history
  const { conversations, activeId, currentMessages, updateMessages, startNew, selectConversation, deleteConversation } = useChatHistory();

  const handleModeChange = useCallback((mode: PrimaryMode) => {
    setPrimaryMode(mode);
  }, []);

  // Analysis mutation
  const analysisMutation = useMutation({
    mutationFn: (file: File) => analyzeCRF(file, true, 5, selectedTable ?? undefined),
    onSuccess: (data) => setAnalysisResults(data),
    onError: (error: any) => console.error('Analysis failed:', error),
  });

  // Bulk mutations
  const bulkPreviewMutation = useMutation({
    mutationFn: (files: File[]) => bulkPreview(files, selectedTable ?? 'main'),
    onSuccess: (data) => {
      setBulkPreviewRecords(data.records);
      setBulkPreviewErrors(data.errors);
    },
    onError: (error: any) => console.error('Bulk preview failed:', error),
  });

  const bulkConfirmMutation = useMutation({
    mutationFn: (records: PreviewRecord[]) => bulkConfirm(records, selectedTable ?? 'main'),
    onSuccess: (data) => setBulkConfirmResult(data),
    onError: (error: any) => console.error('Bulk confirm failed:', error),
  });

  const isBulkPDF = bulkFiles.length > 0 && bulkFiles[0].name.toLowerCase().endsWith('.pdf');

  const handleRemoveRow = (rowIdx: number) =>
    setBulkPreviewRecords(prev => prev.filter((_, i) => i !== rowIdx));

  const handleCellEdit = (rowIdx: number, col: string, value: string) =>
    setBulkPreviewRecords(prev =>
      prev.map((r, i) => i === rowIdx ? { ...r, data: { ...r.data, [col]: value } } : r)
    );

  const resetBulk = () => {
    setBulkFiles([]);
    setBulkPreviewRecords([]);
    setBulkPreviewErrors([]);
    setBulkConfirmResult(null);
    bulkPreviewMutation.reset();
    bulkConfirmMutation.reset();
  };

  useEffect(() => {
    if (bulkPreviewMutation.isSuccess && bulkPreviewRecords.length === 0 && !bulkConfirmMutation.isSuccess) {
      resetBulk();
    }
  }, [bulkPreviewRecords.length, bulkPreviewMutation.isSuccess, bulkConfirmMutation.isSuccess]);

  const handleBulkDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setBulkDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (!dropped.length) return;
    const allPDF = dropped.every(f => f.name.toLowerCase().endsWith('.pdf'));
    const isCSV = dropped.length === 1 && dropped[0].name.toLowerCase().endsWith('.csv');
    if (allPDF || isCSV) { setBulkFiles(dropped); bulkPreviewMutation.reset(); }
  };

  const handleBulkInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) { setBulkFiles(files); bulkPreviewMutation.reset(); }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setAnalysisResults(null);
  };

  const handleAnalyze = () => {
    if (selectedFile) analysisMutation.mutate(selectedFile);
  };

  // ── Bulk upload content (used inside the slide-over panel) ──────────────────
  const BulkContent = (
    <div>
      <p className="text-sm text-gray-400 mb-5">
        Upload a CSV file or one or more PDF files. Records are extracted and shown for review before insertion.
      </p>

      {/* Stage 1: drop zone */}
      {bulkFiles.length === 0 && (
        <div
          onDragOver={e => { e.preventDefault(); setBulkDragOver(true); }}
          onDragLeave={() => setBulkDragOver(false)}
          onDrop={handleBulkDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            bulkDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 bg-gray-50'
          }`}
          onClick={() => document.getElementById('bulk-input')?.click()}
        >
          <Upload className="w-9 h-9 text-gray-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-600">Drop your CSV or PDF files here, or click to browse</p>
          <p className="text-xs text-gray-400 mt-1">.csv (single file) or .pdf (one or more)</p>
          <input id="bulk-input" type="file" accept=".csv,.pdf" multiple className="hidden" onChange={handleBulkInput} />
        </div>
      )}

      {/* Stage 2: files selected, not yet previewed */}
      {bulkFiles.length > 0 && !bulkPreviewMutation.isSuccess && (
        <div className="space-y-3">
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 space-y-2">
            {bulkFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <Upload className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{f.name}</p>
                  <p className="text-xs text-gray-400">{(f.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            ))}
            {!bulkPreviewMutation.isPending && (
              <button onClick={resetBulk} className="text-xs text-gray-400 hover:text-gray-600 transition-colors pt-1">
                Remove all
              </button>
            )}
          </div>

          {!bulkPreviewMutation.isPending && (
            <button
              onClick={() => bulkPreviewMutation.mutate(bulkFiles)}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              {isBulkPDF ? 'Extract & Preview' : 'Parse & Preview'}
            </button>
          )}

          {bulkPreviewMutation.isPending && (
            <div className="flex items-center justify-center gap-3 py-4">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <p className="text-sm text-gray-500">{isBulkPDF ? 'Extracting data from PDFs…' : 'Parsing records…'}</p>
            </div>
          )}

          {bulkPreviewMutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-800">Extraction failed</p>
              <p className="text-sm text-red-700 mt-1">{(bulkPreviewMutation.error as Error)?.message || 'An unexpected error occurred.'}</p>
              <button onClick={() => bulkPreviewMutation.mutate(bulkFiles)} className="mt-3 bg-red-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-red-700 transition-colors">Retry</button>
            </div>
          )}
        </div>
      )}

      {/* Stage 3: preview table */}
      {bulkPreviewMutation.isSuccess && bulkPreviewRecords.length > 0 && !bulkConfirmMutation.isSuccess && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-gray-900">{bulkPreviewRecords.length}</span> record{bulkPreviewRecords.length !== 1 ? 's' : ''} extracted — review before inserting
            </p>
            <button onClick={resetBulk} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Start over</button>
          </div>

          {bulkPreviewErrors.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-yellow-800 mb-1">{bulkPreviewErrors.length} file(s) failed extraction:</p>
              <ul className="list-disc list-inside text-xs text-yellow-700 space-y-0.5">
                {bulkPreviewErrors.map((err, i) => (
                  <li key={i}>{err.crh_number ? `${err.crh_number}: ` : ''}{err.error}</li>
                ))}
              </ul>
            </div>
          )}

          {bulkPreviewRecords.some(r => r.duplicate_of) && (
            <div className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-300 rounded-xl text-sm">
              <span className="text-orange-500 font-bold flex-shrink-0">⚠</span>
              <div>
                <span className="font-semibold text-orange-900">{bulkPreviewRecords.filter(r => r.duplicate_of).length} duplicate(s) detected.</span>{' '}
                <span className="text-orange-800">Highlighted rows already exist in the database.</span>
              </div>
            </div>
          )}

          {(() => {
            const columns = Array.from(new Set(bulkPreviewRecords.flatMap(r => Object.keys(r.data))));
            return (
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2"></th>
                      {columns.map(col => (
                        <th key={col} className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{col}</th>
                      ))}
                      <th className="sticky right-0 bg-gray-50 px-3 py-2 border-l border-gray-200"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bulkPreviewRecords.map((record, i) => {
                      const isDuplicate = Boolean(record.duplicate_of);
                      return (
                        <tr key={i} className={isDuplicate ? 'bg-orange-50' : 'hover:bg-gray-50'}>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {isDuplicate && (
                              <span className="inline-flex items-center gap-1 text-orange-700 font-medium" title={`Duplicate of ${record.duplicate_of}`}>
                                ⚠ {record.duplicate_of}
                              </span>
                            )}
                          </td>
                          {columns.map(col => {
                            const val = record.data[col];
                            const display = val === null || val === undefined ? '' : String(val);
                            const isEditing = editingCell?.row === i && editingCell?.col === col;
                            return (
                              <td key={col} className={`px-1 py-1 max-w-[160px] ${isDuplicate ? 'text-orange-900' : 'text-gray-700'}`}>
                                {isEditing ? (
                                  <input
                                    autoFocus
                                    className="w-full min-w-[80px] px-2 py-1 border border-blue-400 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                    value={display}
                                    onChange={e => handleCellEdit(i, col, e.target.value)}
                                    onBlur={() => setEditingCell(null)}
                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingCell(null); }}
                                  />
                                ) : (
                                  <div
                                    className="px-2 py-1 rounded cursor-pointer hover:bg-blue-50 hover:ring-1 hover:ring-blue-200 truncate"
                                    title={`${display} — click to edit`}
                                    onClick={() => setEditingCell({ row: i, col })}
                                  >
                                    {display || <span className="text-gray-300 italic">—</span>}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td className="sticky right-0 px-3 py-2 border-l border-gray-200 bg-white">
                            <button onClick={() => handleRemoveRow(i)} className="text-gray-300 hover:text-red-500 transition-colors" title="Remove">✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {!bulkConfirmMutation.isPending && (
            <button
              onClick={() => bulkConfirmMutation.mutate(bulkPreviewRecords)}
              disabled={bulkPreviewRecords.length === 0}
              className="w-full bg-green-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirm & Insert {bulkPreviewRecords.length} record{bulkPreviewRecords.length !== 1 ? 's' : ''}
            </button>
          )}

          {bulkConfirmMutation.isPending && (
            <div className="flex items-center justify-center gap-3 py-4">
              <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
              <p className="text-sm text-gray-500">Inserting records…</p>
            </div>
          )}

          {bulkConfirmMutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-800">Insertion failed</p>
              <p className="text-sm text-red-700 mt-1">{(bulkConfirmMutation.error as Error)?.message || 'An unexpected error occurred.'}</p>
              <button onClick={() => bulkConfirmMutation.mutate(bulkPreviewRecords)} className="mt-3 bg-red-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-red-700 transition-colors">Retry</button>
            </div>
          )}
        </div>
      )}

      {/* Stage 4: success */}
      {bulkConfirmMutation.isSuccess && bulkConfirmResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-1">
          <p className="text-sm font-semibold text-green-800">Insertion complete</p>
          <p className="text-sm text-green-700">Inserted: {bulkConfirmResult.inserted.length}</p>
          <p className="text-sm text-green-700">Updated: {bulkConfirmResult.updated.length}</p>
          <p className="text-sm text-green-700">Skipped (already exist): {bulkConfirmResult.skipped.length}</p>
          {bulkConfirmResult.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-semibold text-red-700">Errors:</p>
              <ul className="list-disc list-inside text-sm text-red-600 mt-1 space-y-0.5">
                {bulkConfirmResult.errors.map((err, i) => (
                  <li key={i}>{err.crh_number ? `${err.crh_number}: ` : ''}{err.error}</li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={resetBulk} className="mt-3 w-full bg-white border border-gray-200 text-gray-700 py-2 px-4 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
            Upload Another File
          </button>
        </div>
      )}
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── slide-in animation ── */}
      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.22s ease; }
      `}</style>

      <div className="min-h-screen bg-stone-100">
        {/* ── Header ── */}
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </span>
              <span className="text-sm font-bold text-gray-900 tracking-tight">CRF Platform</span>
            </div>

            <div className="flex-1" />

            {/* Tools dropdown */}
            <ToolsDropdown onSelect={setActiveTool} />

            {/* User / sign-out */}
            {onSignOut && (
              <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
                {userEmail && <span className="text-xs text-gray-400 hidden sm:block">{userEmail}</span>}
                <button
                  onClick={onSignOut}
                  title="Sign out"
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ── Main ── */}
        <main className="max-w-4xl mx-auto px-6 py-8">
          {/* Mode switcher */}
          <ModeSwitcher mode={primaryMode} onSelect={handleModeChange} />

          {/* ── Analysis mode ── */}
          {primaryMode === 'analysis' && (
            <>
              <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
                <h2 className="text-base font-bold text-gray-900 mb-4">Upload CRF Document</h2>
                <FileUpload onFileSelect={handleFileSelect} maxSize={10} />

                {selectedFile && !analysisMutation.isPending && !analysisResults && (
                  <div className="mt-5">
                    <button
                      onClick={handleAnalyze}
                      className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                    >
                      Analyze Document
                    </button>
                  </div>
                )}
              </div>

              {analysisMutation.isPending && (
                <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
                  <p className="mt-4 text-base font-semibold text-gray-900">Analyzing your document…</p>
                  <p className="mt-1 text-sm text-gray-400">Extracting patient data with AI — this may take a moment.</p>
                </div>
              )}

              {analysisResults && !analysisMutation.isPending && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h2 className="text-base font-bold text-gray-900 mb-5">Analysis Results</h2>
                  <AnalysisResults results={analysisResults} />
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <button
                      onClick={() => { setSelectedFile(null); setAnalysisResults(null); }}
                      className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                    >
                      Analyze Another Document
                    </button>
                  </div>
                </div>
              )}

              {analysisMutation.isError && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                  <h3 className="text-base font-semibold text-red-900 mb-2">Analysis Failed</h3>
                  <p className="text-sm text-red-700">
                    {(analysisMutation.error as any)?.response?.data?.detail ||
                     (analysisMutation.error as Error)?.message ||
                     'An unexpected error occurred. Please try again.'}
                  </p>
                  <button onClick={() => analysisMutation.reset()} className="mt-4 bg-red-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-red-700 transition-colors">
                    Try Again
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── Chat mode ── */}
          {primaryMode === 'chat' && (
            <div
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex"
              style={{ height: 'calc(100vh - 200px)', minHeight: '520px' }}
            >
              <ChatSidebar
                conversations={conversations}
                activeId={activeId}
                onSelect={selectConversation}
                onDelete={deleteConversation}
                onNew={startNew}
              />
              <div className="flex-1 p-6 flex flex-col min-w-0 overflow-hidden">
                <Chat
                  messages={currentMessages}
                  onMessagesChange={updateMessages}
                  tableName={selectedTable ?? 'main'}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Tool slide-over panels ── */}
      {activeTool && (
        <SlidePanel tool={activeTool} onClose={() => setActiveTool(null)}>
          {activeTool === 'bulk'    && BulkContent}
          {activeTool === 'reports' && <ReportsTable selectedTable={selectedTable} onTableChange={setSelectedTable} />}
          {activeTool === 'schema'  && <SchemaEditor selectedTable={selectedTable} onTableChange={setSelectedTable} />}
        </SlidePanel>
      )}
    </>
  );
};
