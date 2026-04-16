import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Loader2, RefreshCw, X, Check } from 'lucide-react';
import { getSchema, updateSchema } from '../services/crfService';
import type { SchemaField } from '../services/crfService';

const FIELD_TYPES = ['binary', 'int', 'float', 'str', 'date', 'literal'];

const SECTION_OPTIONS = [
  'INTRODUCTION', 'IDENTIFICATION', 'MOTIF', 'ANAMNESE',
  'ANTECEDENTS', 'TRAITEMENT', 'EXAMEN_CLINIQUE', 'BIOLOGIE',
  'ECG', 'ECHOCARDIOGRAPHIE', 'AU_TOTAL',
];

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    binary: '0 / 1',
    int: 'Entier',
    float: 'Décimal',
    str: 'Texte',
    date: 'Date',
    literal: 'Valeurs fixes',
  };
  return map[type] ?? type;
}

function valuesDisplay(field: SchemaField): string {
  if (field.type === 'literal') {
    const vals = field.literal_values ?? [];
    return vals.length ? vals.join(', ') : '—';
  }
  if (field.type === 'binary') return '0, 1';
  const { ge, le } = field.constraints ?? {};
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
  return {
    ...f,
    _originalName: f.name,
    _literalValuesText: (f.literal_values ?? []).join('\n'),
  };
}

export const SchemaEditor: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: schema, isLoading, isError, refetch } = useQuery<SchemaField[]>({
    queryKey: ['schema'],
    queryFn: getSchema,
  });

  const [editingField, setEditingField] = useState<EditingField | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [pendingRenames, setPendingRenames] = useState<Record<string, string>>({});
  const [localSchema, setLocalSchema] = useState<SchemaField[] | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (schema && localSchema === null) {
      setLocalSchema(schema);
    }
  }, [schema, localSchema]);

  // Keyboard shortcuts for the side panel
  useEffect(() => {
    if (editingField === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClosePanel();
      } else if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
        handleApplyField();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editingField, localSchema]);

  const saveMutation = useMutation({
    mutationFn: ({ fields, renames }: { fields: SchemaField[]; renames: Record<string, string> }) =>
      updateSchema(fields, renames),
    onSuccess: () => {
      setSaveStatus('success');
      setPendingRenames({});
      queryClient.invalidateQueries({ queryKey: ['schema'] });
      setLocalSchema(null);
    },
    onError: (e: any) => {
      setSaveStatus('error');
      setSaveError(e?.message ?? 'Échec de la sauvegarde');
    },
  });

  const handleSelectField = (field: SchemaField) => {
    setEditingField(fieldToEditing(field));
    setIsAddingNew(false);
  };

  const handleAddNew = () => {
    setEditingField({
      name: '',
      type: 'binary',
      description: '',
      sections: [],
      optional: true,
      constraints: {},
      literal_values: [],
      _originalName: '',
      _literalValuesText: '',
    });
    setIsAddingNew(true);
  };

  const handleClosePanel = () => {
    setEditingField(null);
    setIsAddingNew(false);
  };

  const handleApplyField = () => {
    if (!editingField || !localSchema) return;
    const trimmedName = editingField.name.trim();
    if (!trimmedName) return;

    const literal_values = editingField.type === 'literal'
      ? editingField._literalValuesText.split('\n').map(v => v.trim()).filter(Boolean)
      : [];

    const updatedField: SchemaField = {
      name: trimmedName,
      type: editingField.type,
      description: editingField.description,
      sections: editingField.sections,
      optional: editingField.optional,
      constraints: editingField.constraints ?? {},
      literal_values,
    };

    let newSchema: SchemaField[];
    let newRenames = { ...pendingRenames };

    if (isAddingNew) {
      newSchema = [...localSchema, updatedField];
    } else {
      if (editingField._originalName && editingField._originalName !== trimmedName) {
        newRenames[editingField._originalName] = trimmedName;
        setPendingRenames(newRenames);
      }
      newSchema = localSchema.map(f =>
        f.name === editingField._originalName ? updatedField : f
      );
    }

    setLocalSchema(newSchema);
    setEditingField(null);
    setIsAddingNew(false);
    setSaveStatus('idle');
  };

  const handleSaveAll = () => {
    if (!localSchema) return;
    setSaveStatus('saving');
    setSaveError('');
    saveMutation.mutate({ fields: localSchema, renames: pendingRenames });
  };

  const hasUnsavedChanges = localSchema !== null && JSON.stringify(localSchema) !== JSON.stringify(schema);
  const displaySchema = localSchema ?? schema ?? [];
  const panelOpen = editingField !== null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700 font-medium">Impossible de charger le schéma</p>
        <button onClick={() => refetch()} className="mt-3 text-sm text-red-600 underline">Réessayer</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Schéma des champs CRF</h2>
          <p className="text-sm text-gray-500 mt-0.5">{displaySchema.length} champs · Cliquer sur une ligne pour modifier</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setLocalSchema(null); refetch(); setSaveStatus('idle'); setPendingRenames({}); handleClosePanel(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualiser
          </button>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter
          </button>
          {hasUnsavedChanges && (
            <button
              onClick={handleSaveAll}
              disabled={saveStatus === 'saving'}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                saveStatus === 'success'
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : saveStatus === 'error'
                  ? 'bg-red-100 text-red-700 border border-red-300'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-60`}
            >
              {saveStatus === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saveStatus === 'saving' ? 'Enregistrement...' : saveStatus === 'success' ? 'Enregistré !' : saveStatus === 'error' ? 'Erreur' : 'Enregistrer'}
            </button>
          )}
        </div>
      </div>

      {saveStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{saveError}</div>
      )}

      {Object.keys(pendingRenames).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <span className="font-medium">Renommages en attente :</span>{' '}
          {Object.entries(pendingRenames).map(([o, n]) => `"${o}" → "${n}"`).join(', ')}
        </div>
      )}

      {/* Split layout: table + side panel */}
      <div className={`flex gap-4 items-start transition-all`}>

        {/* Table */}
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
                const isSelected = editingField?._originalName === field.name || (isAddingNew && false);
                return (
                  <tr
                    key={field.name}
                    onClick={() => handleSelectField(field)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50 border-l-2 border-l-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-3 py-2.5 font-mono text-xs font-medium text-gray-900 whitespace-nowrap">{field.name}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">{typeLabel(field.type)}</span>
                    </td>
                    {!panelOpen && (
                      <>
                        <td className="px-3 py-2.5 hidden md:table-cell text-xs text-gray-500 max-w-[160px] truncate">
                          {(field.sections ?? []).join(', ') || '—'}
                        </td>
                        <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-gray-500 max-w-[160px] truncate">
                          {valuesDisplay(field)}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[220px] truncate">
                      {field.description || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Side panel */}
        {panelOpen && editingField && (
          <div className="flex-[2] min-w-[300px] border border-gray-200 rounded-lg overflow-hidden flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">
                {isAddingNew ? 'Nouveau champ' : editingField._originalName}
              </h3>
              <button onClick={handleClosePanel} className="text-gray-400 hover:text-gray-600 p-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Panel body — scrollable */}
            <div className="overflow-y-auto p-4 space-y-4 flex-1" style={{ maxHeight: '70vh' }}>

              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nom du champ</label>
                <input
                  type="text"
                  value={editingField.name}
                  onChange={e => setEditingField({ ...editingField, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="nom_du_champ"
                />
                {!isAddingNew && editingField.name !== editingField._originalName && (
                  <p className="text-xs text-amber-600 mt-1">Renommage appliqué à Supabase à l'enregistrement.</p>
                )}
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                <select
                  value={editingField.type}
                  onChange={e => setEditingField({ ...editingField, type: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {FIELD_TYPES.map(t => (
                    <option key={t} value={t}>{typeLabel(t)} ({t})</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Description <span className="text-gray-400 font-normal">(utilisée par l'IA pour extraire ce champ)</span>
                </label>
                <textarea
                  value={editingField.description}
                  onChange={e => setEditingField({ ...editingField, description: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  style={{ minHeight: '120px', maxHeight: '300px', overflowY: 'auto' }}
                  placeholder="Description utilisée par l'IA pour extraire ce champ..."
                  onInput={e => {
                    const el = e.currentTarget;
                    el.style.height = 'auto';
                    el.style.height = Math.min(el.scrollHeight, 300) + 'px';
                  }}
                />
              </div>

              {/* Sections */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Sections <span className="text-gray-400 font-normal">(ctrl+clic pour plusieurs)</span>
                </label>
                <select
                  multiple
                  value={editingField.sections ?? []}
                  onChange={e => setEditingField({
                    ...editingField,
                    sections: Array.from(e.target.selectedOptions, o => o.value),
                  })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 h-28"
                >
                  {SECTION_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Constraints */}
              {(editingField.type === 'int' || editingField.type === 'float' || editingField.type === 'binary') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Min (ge)</label>
                    <input
                      type="number"
                      value={editingField.constraints?.ge ?? ''}
                      onChange={e => setEditingField({
                        ...editingField,
                        constraints: { ...editingField.constraints, ge: e.target.value === '' ? undefined : Number(e.target.value) },
                      })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="aucun"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Max (le)</label>
                    <input
                      type="number"
                      value={editingField.constraints?.le ?? ''}
                      onChange={e => setEditingField({
                        ...editingField,
                        constraints: { ...editingField.constraints, le: e.target.value === '' ? undefined : Number(e.target.value) },
                      })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="aucun"
                    />
                  </div>
                </div>
              )}

              {/* Literal values */}
              {editingField.type === 'literal' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Valeurs autorisées <span className="text-gray-400 font-normal">(une par ligne)</span></label>
                  <textarea
                    value={editingField._literalValuesText}
                    onChange={e => setEditingField({ ...editingField, _literalValuesText: e.target.value })}
                    rows={7}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
                    placeholder={'valeur 1\nvaleur 2\nvaleur 3'}
                  />
                </div>
              )}
            </div>

            {/* Panel footer */}
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2 bg-white">
              <button
                onClick={handleClosePanel}
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleApplyField}
                disabled={!editingField.name.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                {isAddingNew ? 'Ajouter' : 'Appliquer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
