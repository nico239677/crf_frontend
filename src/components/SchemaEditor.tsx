import React, { useState, useEffect, useId } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, RefreshCw, X, Check, Table2, ArrowLeft, Pencil } from 'lucide-react';
import { getSchema, updateSchema, getTables, renameTable } from '../services/crfService';
import type { SchemaField } from '../services/crfService';
import { TableDropdown } from './TableDropdown';

// 'int' kept for backward-compat display only — new fields use 'float' shown as "Numerical"
const FIELD_TYPES = ['binary', 'float', 'str', 'date', 'literal'];

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    binary: '0 / 1', int: 'Numerical', float: 'Numerical', str: 'Text', date: 'Date', literal: 'Fixed values',
  };
  return map[type] ?? type;
}

function valuesDisplay(field: SchemaField): string {
  if (field.type === 'literal') { const vals = field.literal_values ?? []; return vals.length ? vals.join(', ') : '—'; }
  if (field.type === 'binary') return '0, 1';
  const { ge, le } = field.constraints ?? {};
  if (field.type === 'date') {
    if (ge && le) return `${ge} – ${le}`;
    if (ge) return `≥ ${ge}`;
    if (le) return `≤ ${le}`;
    return '—';
  }
  if (ge !== undefined && le !== undefined) return `${ge} – ${le}`;
  if (ge !== undefined) return `≥ ${ge}`;
  if (le !== undefined) return `≤ ${le}`;
  return '—';
}

interface EditingField extends SchemaField {
  _originalName: string;
  _literalValuesText: string;
}

function fieldToEditing(f: SchemaField): EditingField {
  return { ...f, _originalName: f.name, _literalValuesText: (f.literal_values ?? []).join('\n') };
}

// ---------------------------------------------------------------------------
// Shared row type used by both CreateTableForm and inline add-row
// ---------------------------------------------------------------------------

interface NewRow {
  id: string;
  name: string;
  type: string;
  description: string;
  sections: string;
  ge: string;
  le: string;
  confirmed: boolean;
}

function emptyRow(id: string): NewRow {
  return { id, name: '', type: 'str', description: '', sections: '', ge: '', le: '', confirmed: false };
}

function isRowValid(r: Pick<NewRow, 'name' | 'type' | 'description'>) {
  return r.name.trim().length > 0 && r.type.length > 0 && r.description.trim().length > 0;
}

function rowToField(r: NewRow): SchemaField {
  const isLiteral = r.type === 'literal';
  const isDate = r.type === 'date';
  return {
    name: r.name.trim(),
    type: r.type,
    description: r.description.trim(),
    sections: r.sections.split(',').map(s => s.trim()).filter(Boolean),
    optional: true,
    constraints: isLiteral ? {} : {
      ...(r.ge !== '' ? { ge: isDate ? r.ge : Number(r.ge) } : {}),
      ...(r.le !== '' ? { le: isDate ? r.le : Number(r.le) } : {}),
    },
    literal_values: isLiteral
      ? r.ge.split(',').map(v => v.trim()).filter(Boolean)
      : [],
  };
}

const showConstraints = (type: string) => ['int', 'float', 'binary'].includes(type);

// 6-column grid: name | type | description | sections | values | action
const GRID = '1fr 110px 2fr 140px 160px 80px';

const isNumerical = (type: string) => type === 'float' || type === 'int';

// ---------------------------------------------------------------------------
// RowInputs — reused for both create-table and inline-add
// ---------------------------------------------------------------------------

interface RowInputsProps {
  row: NewRow;
  onChange: (patch: Partial<NewRow>) => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmDisabled: boolean;
}

const RowInputs: React.FC<RowInputsProps> = ({ row, onChange, onConfirm, confirmLabel, confirmDisabled }) => (
  <div className="grid items-start gap-2 px-3 py-2.5 bg-white"
    style={{ gridTemplateColumns: GRID }}>
    <input type="text" value={row.name} onChange={e => onChange({ name: e.target.value })}
      placeholder="col_name"
      className="border border-gray-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 w-full" />
    <select value={row.type} onChange={e => onChange({ type: e.target.value, ge: '', le: '' })}
      className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 w-full">
      {FIELD_TYPES.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
    </select>
    <input type="text" value={row.description} onChange={e => onChange({ description: e.target.value })}
      placeholder="Description for AI…"
      className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 w-full" />
    <input type="text" value={row.sections} onChange={e => onChange({ sections: e.target.value })}
      placeholder="sec1, sec2"
      className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 w-full" />
    {/* Values cell — dynamic per type */}
    {isNumerical(row.type) ? (
      <div className="flex gap-1">
        <input type="number" value={row.ge} onChange={e => onChange({ ge: e.target.value })}
          placeholder="min"
          className="border border-gray-200 rounded px-2 py-1 text-xs text-gray-400 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400 w-full focus:text-gray-700" />
        <input type="number" value={row.le} onChange={e => onChange({ le: e.target.value })}
          placeholder="max"
          className="border border-gray-200 rounded px-2 py-1 text-xs text-gray-400 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400 w-full focus:text-gray-700" />
      </div>
    ) : row.type === 'date' ? (
      <div className="flex gap-1">
        <input type="date" value={row.ge} onChange={e => onChange({ ge: e.target.value })}
          className="border border-gray-200 rounded px-1 py-1 text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 w-full" />
        <input type="date" value={row.le} onChange={e => onChange({ le: e.target.value })}
          className="border border-gray-200 rounded px-1 py-1 text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 w-full" />
      </div>
    ) : row.type === 'literal' ? (
      <input type="text" value={row.ge} onChange={e => onChange({ ge: e.target.value })}
        placeholder="cat1, cat2, cat3"
        className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 w-full" />
    ) : (
      <div className="rounded bg-gray-50 border border-gray-100 px-2 py-1 text-xs text-gray-300 select-none">—</div>
    )}
    <button onClick={onConfirm} disabled={confirmDisabled}
      title={confirmDisabled ? 'Name, type and description required' : confirmLabel}
      className="flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors w-full">
      <Check className="w-3 h-3" />
      {confirmLabel}
    </button>
  </div>
);

// ---------------------------------------------------------------------------
// CreateTableForm
// ---------------------------------------------------------------------------

interface CreateTableFormProps {
  onSave: (tableName: string, fields: SchemaField[]) => void;
  onCancel?: () => void;
  saving: boolean;
}

const CreateTableForm: React.FC<CreateTableFormProps> = ({ onSave, onCancel, saving }) => {
  const uid = useId();
  const [tableName, setTableName] = useState('');
  const [rows, setRows] = useState<NewRow[]>([emptyRow(uid + '-0')]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<NewRow | null>(null);

  const updateActiveRow = (id: string, patch: Partial<NewRow>) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

  const confirmRow = (id: string) => {
    setRows(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, confirmed: true } : r);
      return [...updated, emptyRow(`${uid}-${Date.now()}`)];
    });
  };

  const removeRow = (id: string) =>
    setRows(prev => {
      const remaining = prev.filter(r => r.id !== id);
      // always keep at least one unconfirmed row
      const hasActive = remaining.some(r => !r.confirmed);
      return hasActive ? remaining : [...remaining, emptyRow(`${uid}-rm-${Date.now()}`)];
    });

  const startEdit = (row: NewRow) => {
    setEditingId(row.id);
    setEditDraft({ ...row });
  };

  const applyEdit = () => {
    if (!editDraft || !isRowValid(editDraft)) return;
    setRows(prev => prev.map(r => r.id === editDraft.id ? { ...editDraft, confirmed: true } : r));
    setEditingId(null);
    setEditDraft(null);
  };

  const cancelEdit = () => { setEditingId(null); setEditDraft(null); };

  const confirmedFields = rows.filter(r => r.confirmed).map(rowToField);
  const canSave = tableName.trim().length > 0 && confirmedFields.length > 0;

  return (
    <div className="space-y-5">
      {/* Table name */}
      <div className="flex items-center gap-3">
        <Table2 className="w-5 h-5 text-blue-500 shrink-0" />
        <input type="text" value={tableName} onChange={e => setTableName(e.target.value)}
          placeholder="Nom de la table (ex : cardiologie)"
          className="w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
        {tableName.trim() && (
          <span className="text-xs text-gray-400">→ <span className="font-mono text-gray-600">{tableName.trim()}</span></span>
        )}
      </div>

      {/* Rows */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide px-3 py-2"
          style={{ gridTemplateColumns: GRID }}>
          <span>Nom <span className="text-red-400">*</span></span>
          <span>Type <span className="text-red-400">*</span></span>
          <span>Description <span className="text-red-400">*</span></span>
          <span>Sections</span>
          <span>Valeurs possibles</span>
          <span></span>
        </div>

        {/* Confirmed rows */}
        {rows.filter(r => r.confirmed).map(r => {
          if (editingId === r.id && editDraft) {
            return (
              <div key={r.id} className="border-b border-gray-100 bg-blue-50">
                <RowInputs
                  row={editDraft}
                  onChange={patch => setEditDraft(prev => prev ? { ...prev, ...patch } : prev)}
                  onConfirm={applyEdit}
                  confirmLabel="Apply"
                  confirmDisabled={!isRowValid(editDraft)}
                />
                <div className="flex justify-end px-3 pb-2">
                  <button onClick={cancelEdit} className="text-xs text-gray-400 hover:text-gray-600 underline">Annuler</button>
                </div>
              </div>
            );
          }
          return (
            <div key={r.id}
              onClick={() => startEdit(r)}
              className="grid items-center gap-2 px-3 py-2 border-b border-gray-100 bg-green-50 hover:bg-green-100 cursor-pointer transition-colors group"
              style={{ gridTemplateColumns: GRID }}
              title="Cliquer pour modifier">
              <span className="font-mono text-xs font-medium truncate">{r.name}</span>
              <span className="text-xs">
                <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{typeLabel(r.type)}</span>
              </span>
              <span className="text-xs text-gray-500 truncate" title={r.description}>{r.description}</span>
              <span className="text-xs text-gray-400 truncate">{r.sections || '—'}</span>
              <span className="text-xs text-gray-400">{r.ge || '—'}</span>
              <span className="text-xs text-gray-400">{r.le || '—'}</span>
              <button onClick={e => { e.stopPropagation(); removeRow(r.id); }}
                className="text-gray-300 hover:text-red-400 transition-colors justify-self-center opacity-0 group-hover:opacity-100">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}

        {/* Active (unconfirmed) row */}
        {rows.filter(r => !r.confirmed).map(r => (
          <RowInputs key={r.id}
            row={r}
            onChange={patch => updateActiveRow(r.id, patch)}
            onConfirm={() => confirmRow(r.id)}
            confirmLabel="Add"
            confirmDisabled={!isRowValid(r)}
          />
        ))}
      </div>

      {confirmedFields.length === 0 && (
        <p className="text-xs text-gray-400 text-center">Remplissez la première ligne et cliquez sur <strong>Add</strong> pour ajouter une colonne.</p>
      )}

      <div className="flex items-center justify-between">
        {onCancel ? (
          <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" /> Annuler
          </button>
        ) : <span />}
        <button onClick={() => onSave(tableName.trim(), confirmedFields)} disabled={!canSave || saving}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Enregistrement…' : `Créer la table${confirmedFields.length > 0 ? ` (${confirmedFields.length} colonne${confirmedFields.length > 1 ? 's' : ''})` : ''}`}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// SchemaEditor
// ---------------------------------------------------------------------------

interface SchemaEditorProps {
  selectedTable: string | null;
  onTableChange: (name: string) => void;
}

export const SchemaEditor: React.FC<SchemaEditorProps> = ({ selectedTable, onTableChange }) => {
  const queryClient = useQueryClient();
  const uid = useId();

  const [creatingNewTable, setCreatingNewTable] = useState(false);
  const [renamingTable, setRenamingTable] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

  // Use the shared selected table; fall back to empty string while nothing is selected
  const tableName = selectedTable ?? '';

  const setTableName = (name: string) => onTableChange(name);

  const { data: tables, isLoading: tablesLoading } = useQuery<string[]>({
    queryKey: ['tables'],
    queryFn: getTables,
    staleTime: Infinity,
  });

  // Auto-select first table if nothing selected yet
  useEffect(() => {
    if (tables && tables.length > 0 && selectedTable === null) {
      onTableChange(tables[0]);
    }
  }, [tables, selectedTable, onTableChange]);

  const { data: schema, isLoading, isError, refetch } = useQuery<SchemaField[]>({
    queryKey: ['schema', tableName],
    queryFn: () => getSchema(tableName),
    enabled: tableName.length > 0,
  });

  const [editingField, setEditingField] = useState<EditingField | null>(null);
  const [pendingRenames, setPendingRenames] = useState<Record<string, string>>({});
  const [localSchema, setLocalSchema] = useState<SchemaField[] | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  // Inline add-row state (bottom of existing table)
  const [addDraft, setAddDraft] = useState<NewRow>(() => emptyRow(uid + '-add'));

  useEffect(() => {
    if (schema && localSchema === null) setLocalSchema(schema);
  }, [schema, localSchema]);

  useEffect(() => {
    if (editingField === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClosePanel();
      else if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
        handleApplyField();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editingField, localSchema]);

  const saveMutation = useMutation({
    mutationFn: ({ fields, renames, table }: { fields: SchemaField[]; renames: Record<string, string>; table: string }) =>
      updateSchema(fields, renames, table),
    onSuccess: () => {
      setSaveStatus('success');
      setPendingRenames({});
      queryClient.invalidateQueries({ queryKey: ['schema'] });
      setLocalSchema(null);
      setCreatingNewTable(false);
    },
    onError: (e: any) => {
      setSaveStatus('error');
      setSaveError(e?.message ?? 'Échec de la sauvegarde');
    },
  });

  const handleSelectField = (field: SchemaField) => setEditingField(fieldToEditing(field));
  const handleClosePanel = () => setEditingField(null);

  const isFieldValid = (f: EditingField) =>
    f.name.trim().length > 0 && f.type.length > 0 && f.description.trim().length > 0;

  const handleApplyField = () => {
    if (!editingField || !localSchema || !isFieldValid(editingField)) return;
    const trimmedName = editingField.name.trim();
    const literal_values = editingField.type === 'literal'
      ? editingField._literalValuesText.split('\n').map(v => v.trim()).filter(Boolean) : [];
    const updatedField: SchemaField = {
      name: trimmedName, type: editingField.type, description: editingField.description,
      sections: editingField.sections, optional: editingField.optional,
      constraints: editingField.constraints ?? {}, literal_values,
    };
    let newRenames = { ...pendingRenames };
    if (editingField._originalName && editingField._originalName !== trimmedName) {
      newRenames[editingField._originalName] = trimmedName;
      setPendingRenames(newRenames);
    }
    setLocalSchema(localSchema.map(f => f.name === editingField._originalName ? updatedField : f));
    setEditingField(null);
    setSaveStatus('idle');
  };

  const handleAddInline = () => {
    if (!isRowValid(addDraft)) return;
    setLocalSchema(prev => [...(prev ?? []), rowToField(addDraft)]);
    setAddDraft(emptyRow(uid + '-add-' + Date.now()));
    setSaveStatus('idle');
  };

  const handleSaveAll = () => {
    if (!localSchema) return;
    setSaveStatus('saving');
    setSaveError('');
    saveMutation.mutate({ fields: localSchema, renames: pendingRenames, table: tableName });
  };

  const startRename = () => {
    setRenameValue(tableName);
    setRenameError('');
    setRenamingTable(true);
  };

  const cancelRename = () => {
    setRenamingTable(false);
    setRenameError('');
  };

  const confirmRename = async () => {
    const newName = renameValue.trim();
    if (!newName || newName === tableName) { cancelRename(); return; }
    if (tables?.includes(newName)) {
      setRenameError(`Le nom "${newName}" est déjà utilisé.`);
      return;
    }
    setRenameSaving(true);
    setRenameError('');
    try {
      await renameTable(tableName, newName);
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['schema', tableName] });
      onTableChange(newName);
      setRenamingTable(false);
    } catch (e: any) {
      setRenameError(e?.message ?? 'Échec du renommage');
    } finally {
      setRenameSaving(false);
    }
  };

  const handleSaveNewTable = (newTableName: string, fields: SchemaField[]) => {
    setTableName(newTableName);
    setLocalSchema(fields);
    setSaveStatus('saving');
    setSaveError('');
    saveMutation.mutate({ fields, renames: {}, table: newTableName });
  };

  const hasUnsavedChanges = localSchema !== null && JSON.stringify(localSchema) !== JSON.stringify(schema);
  const displaySchema = localSchema ?? schema ?? [];
  const panelOpen = editingField !== null;

  // Tables list still loading
  if (tablesLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
    </div>
  );

  // No tables exist yet for this user → always show create form
  const noTablesExist = !tables || tables.length === 0;

  // Show create form when: no tables at all, OR user pressed "Nouvelle table"
  const showCreateForm = noTablesExist || creatingNewTable;

  if (isLoading && !showCreateForm) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
    </div>
  );

  if (isError) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <p className="text-red-700 font-medium">Impossible de charger le schéma</p>
      <button onClick={() => refetch()} className="mt-3 text-sm text-red-600 underline">Réessayer</button>
    </div>
  );

  // ── Create new table view ────────────────────────────────────────────────
  if (showCreateForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-semibold text-gray-900">Nouvelle table</h2>
              {tables && tables.length > 0 && (
                <TableDropdown
                  tables={tables}
                  selected={tableName || tables[0]}
                  onSelect={(name) => {
                    setTableName(name);
                    setLocalSchema(null);
                    setCreatingNewTable(false);
                    setSaveStatus('idle');
                  }}
                />
              )}
            </div>
            <p className="text-sm text-gray-500">
              {noTablesExist
                ? 'Aucune table trouvée. Définissez vos colonnes ci-dessous puis créez votre première table.'
                : `Définissez les colonnes de la nouvelle table.`}
            </p>
          </div>
        </div>
        {saveStatus === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{saveError}</div>
        )}
        <CreateTableForm
          onSave={handleSaveNewTable}
          onCancel={!noTablesExist ? () => setCreatingNewTable(false) : undefined}
          saving={saveStatus === 'saving'}
        />
      </div>
    );
  }

  // ── Existing schema view ────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-gray-900">Schéma</h2>
          {tables && tables.length > 0 && !renamingTable && (
            <div className="flex items-center gap-1">
              <TableDropdown
                tables={tables}
                selected={tableName}
                onSelect={(name) => {
                  setTableName(name);
                  setLocalSchema(null);
                  setEditingField(null);
                  setPendingRenames({});
                  setSaveStatus('idle');
                }}
              />
              <button
                onClick={startRename}
                title="Renommer la table"
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {renamingTable && (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') confirmRename();
                  if (e.key === 'Escape') cancelRename();
                }}
                className="border border-blue-400 rounded-lg px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 w-44"
              />
              <button
                onClick={confirmRename}
                disabled={renameSaving || !renameValue.trim()}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                {renameSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                OK
              </button>
              <button onClick={cancelRename} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
              {renameError && <span className="text-xs text-red-600">{renameError}</span>}
            </div>
          )}
          {!renamingTable && (
            <p className="text-sm text-gray-500">
              {displaySchema.length} champ{displaySchema.length !== 1 ? 's' : ''} · cliquer sur une ligne pour modifier
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setLocalSchema(null); refetch(); setSaveStatus('idle'); setPendingRenames({}); handleClosePanel(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-3.5 h-3.5" /> Actualiser
          </button>
          <button onClick={() => setCreatingNewTable(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
            <Table2 className="w-3.5 h-3.5" /> Nouvelle table
          </button>
          {hasUnsavedChanges && (
            <button onClick={handleSaveAll} disabled={saveStatus === 'saving'}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                saveStatus === 'success' ? 'bg-green-100 text-green-700 border border-green-300'
                : saveStatus === 'error' ? 'bg-red-100 text-red-700 border border-red-300'
                : 'bg-blue-600 text-white hover:bg-blue-700'} disabled:opacity-60`}>
              {saveStatus === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saveStatus === 'saving' ? 'Enregistrement...' : saveStatus === 'success' ? 'Enregistré !' : saveStatus === 'error' ? 'Erreur' : 'Enregistrer'}
            </button>
          )}
        </div>
      </div>

      {saveStatus === 'error' && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{saveError}</div>}
      {Object.keys(pendingRenames).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <span className="font-medium">Renommages en attente :</span>{' '}
          {Object.entries(pendingRenames).map(([o, n]) => `"${o}" → "${n}"`).join(', ')}
        </div>
      )}

      {/* Split layout: table + side panel */}
      <div className="flex gap-4 items-start">
        <div className={`min-w-0 border border-gray-200 rounded-lg overflow-hidden ${panelOpen ? 'flex-[3]' : 'flex-1'}`}>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium text-gray-600">Nom du champ</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-600">Type</th>
                {!panelOpen && (
                  <>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-600 hidden md:table-cell">Sections</th>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-600 hidden lg:table-cell">Valeurs</th>
                  </>
                )}
                <th className="text-left px-3 py-2.5 font-medium text-gray-600">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displaySchema.map((field) => {
                const isSelected = editingField?._originalName === field.name;
                return (
                  <tr key={field.name} onClick={() => handleSelectField(field)}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50'}`}>
                    <td className="px-3 py-2.5 font-mono text-xs font-medium text-gray-900 whitespace-nowrap">{field.name}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">{typeLabel(field.type)}</span>
                    </td>
                    {!panelOpen && (
                      <>
                        <td className="px-3 py-2.5 hidden md:table-cell text-xs text-gray-500 max-w-[160px] truncate">{(field.sections ?? []).join(', ') || '—'}</td>
                        <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-gray-500 max-w-[160px] truncate">{valuesDisplay(field)}</td>
                      </>
                    )}
                    <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[220px] truncate">{field.description || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Inline add row at the bottom */}
          <div className="border-t border-dashed border-gray-200">
            <div className="grid bg-gray-50 text-xs font-medium text-gray-400 px-3 py-1.5"
              style={{ gridTemplateColumns: GRID }}>
              <span>Nom *</span><span>Type *</span><span>Description *</span>
              <span>Sections</span><span>Valeurs possibles</span><span></span>
            </div>
            <RowInputs
              row={addDraft}
              onChange={patch => setAddDraft(prev => ({ ...prev, ...patch }))}
              onConfirm={handleAddInline}
              confirmLabel="Add"
              confirmDisabled={!isRowValid(addDraft)}
            />
          </div>
        </div>

        {/* Side panel — edit existing field */}
        {panelOpen && editingField && (
          <div className="flex-[2] min-w-[300px] border border-gray-200 rounded-lg overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">{editingField._originalName}</h3>
              <button onClick={handleClosePanel} className="text-gray-400 hover:text-gray-600 p-0.5"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto p-4 space-y-4 flex-1" style={{ maxHeight: '70vh' }}>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nom du champ</label>
                <input type="text" value={editingField.name} onChange={e => setEditingField({ ...editingField, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="nom_du_champ" />
                {editingField.name !== editingField._originalName && (
                  <p className="text-xs text-amber-600 mt-1">Renommage appliqué à Supabase à l'enregistrement.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                <select value={editingField.type} onChange={e => setEditingField({ ...editingField, type: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  {FIELD_TYPES.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Description <span className="text-gray-400 font-normal">(utilisée par l'IA pour extraire ce champ)</span>
                </label>
                <textarea value={editingField.description} onChange={e => setEditingField({ ...editingField, description: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  style={{ minHeight: '120px', maxHeight: '300px', overflowY: 'auto' }}
                  placeholder="Description utilisée par l'IA pour extraire ce champ..."
                  onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 300) + 'px'; }} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Sections <span className="text-gray-400 font-normal">(texte libre, séparé par des virgules)</span>
                </label>
                <input type="text"
                  value={(editingField.sections ?? []).join(', ')}
                  onChange={e => setEditingField({ ...editingField, sections: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="section1, section2" />
              </div>
              {showConstraints(editingField.type) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Min</label>
                    <input type="number" value={editingField.constraints?.ge ?? ''}
                      onChange={e => setEditingField({ ...editingField, constraints: { ...editingField.constraints, ge: e.target.value === '' ? undefined : Number(e.target.value) } })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="aucun" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Max</label>
                    <input type="number" value={editingField.constraints?.le ?? ''}
                      onChange={e => setEditingField({ ...editingField, constraints: { ...editingField.constraints, le: e.target.value === '' ? undefined : Number(e.target.value) } })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="aucun" />
                  </div>
                </div>
              )}
              {editingField.type === 'date' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Date min</label>
                    <input type="date"
                      value={typeof editingField.constraints?.ge === 'string' ? editingField.constraints.ge : ''}
                      onChange={e => setEditingField({ ...editingField, constraints: { ...editingField.constraints, ge: e.target.value || undefined } })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Date max</label>
                    <input type="date"
                      value={typeof editingField.constraints?.le === 'string' ? editingField.constraints.le : ''}
                      onChange={e => setEditingField({ ...editingField, constraints: { ...editingField.constraints, le: e.target.value || undefined } })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                </div>
              )}
              {editingField.type === 'literal' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Valeurs autorisées <span className="text-gray-400 font-normal">(une par ligne)</span></label>
                  <textarea value={editingField._literalValuesText} onChange={e => setEditingField({ ...editingField, _literalValuesText: e.target.value })}
                    rows={7} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
                    placeholder={'valeur 1\nvaleur 2\nvaleur 3'} />
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-200 bg-white space-y-2">
              {!isFieldValid(editingField) && (
                <p className="text-xs text-amber-600">
                  Requis :{' '}
                  {[!editingField.name.trim() && 'nom', !editingField.type && 'type', !editingField.description.trim() && 'description'].filter(Boolean).join(', ')}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={handleClosePanel} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={handleApplyField} disabled={!isFieldValid(editingField)}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  <Check className="w-3.5 h-3.5" /> Appliquer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
