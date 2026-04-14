import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Save, Loader2, RefreshCw, X, Check } from 'lucide-react';
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
    return field.literal_values?.join(', ') || '—';
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
  _literalValuesText: string; // textarea raw text for literal_values
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

  // Keep localSchema in sync with fetched schema (only on first load)
  useEffect(() => {
    if (schema && localSchema === null) {
      setLocalSchema(schema);
    }
  }, [schema, localSchema]);

  const saveMutation = useMutation({
    mutationFn: ({ fields, renames }: { fields: SchemaField[]; renames: Record<string, string> }) =>
      updateSchema(fields, renames),
    onSuccess: () => {
      setSaveStatus('success');
      setPendingRenames({});
      queryClient.invalidateQueries({ queryKey: ['schema'] });
      setLocalSchema(null); // will reload from query
    },
    onError: (e: any) => {
      setSaveStatus('error');
      setSaveError(e?.message ?? 'Échec de la sauvegarde');
    },
  });

  const handleEditField = (field: SchemaField) => {
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

  const handleCancelEdit = () => {
    setEditingField(null);
    setIsAddingNew(false);
  };

  const handleSaveField = () => {
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

    if (isAddingNew) {
      setLocalSchema([...localSchema, updatedField]);
    } else {
      // Track rename if name changed
      if (editingField._originalName && editingField._originalName !== trimmedName) {
        setPendingRenames(prev => ({ ...prev, [editingField._originalName]: trimmedName }));
      }
      setLocalSchema(localSchema.map(f =>
        f.name === editingField._originalName ? updatedField : f
      ));
    }

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Schéma des champs CRF</h2>
          <p className="text-sm text-gray-500 mt-0.5">{displaySchema.length} champs · Cliquer sur un champ pour le modifier</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setLocalSchema(null); refetch(); setSaveStatus('idle'); setPendingRenames({}); }}
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
            Ajouter un champ
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
              {saveStatus === 'saving' ? 'Enregistrement...' : saveStatus === 'success' ? 'Enregistré !' : saveStatus === 'error' ? 'Erreur' : 'Enregistrer les modifications'}
            </button>
          )}
        </div>
      </div>

      {saveStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{saveError}</div>
      )}

      {/* Pending renames notice */}
      {Object.keys(pendingRenames).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <span className="font-medium">Renommages en attente :</span>{' '}
          {Object.entries(pendingRenames).map(([o, n]) => `"${o}" → "${n}"`).join(', ')}
          {' '}(sera appliqué à Supabase à l'enregistrement)
        </div>
      )}

      {/* Schema table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Nom du champ</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 hidden md:table-cell">Sections</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 hidden lg:table-cell">Valeurs / Plage</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Description</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displaySchema.map((field) => (
              <tr key={field.name} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs font-medium text-gray-900">{field.name}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">{typeLabel(field.type)}</span>
                </td>
                <td className="px-4 py-2.5 hidden md:table-cell text-xs text-gray-500 max-w-[180px] truncate">
                  {(field.sections ?? []).join(', ') || '—'}
                </td>
                <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-gray-500 max-w-[200px] truncate">
                  {valuesDisplay(field)}
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-600 max-w-xs truncate" title={field.description}>
                  {field.description || '—'}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => handleEditField(field)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Modifier"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit / Add modal */}
      {editingField && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">
                {isAddingNew ? 'Ajouter un champ' : `Modifier "${editingField._originalName}"`}
              </h3>
              <button onClick={handleCancelEdit} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nom du champ</label>
                <input
                  type="text"
                  value={editingField.name}
                  onChange={e => setEditingField({ ...editingField, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="nom_du_champ"
                />
                {!isAddingNew && editingField.name !== editingField._originalName && (
                  <p className="text-xs text-amber-600 mt-1">Le renommage sera appliqué à la table Supabase crf_patients.</p>
                )}
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
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
                <label className="block text-xs font-medium text-gray-600 mb-1">Description (prompt AI)</label>
                <textarea
                  value={editingField.description}
                  onChange={e => setEditingField({ ...editingField, description: e.target.value })}
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
                  placeholder="Description utilisée par l'IA pour extraire ce champ..."
                />
              </div>

              {/* Sections */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sections (ctrl+clic pour sélection multiple)</label>
                <select
                  multiple
                  value={editingField.sections ?? []}
                  onChange={e => setEditingField({
                    ...editingField,
                    sections: Array.from(e.target.selectedOptions, o => o.value),
                  })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 h-32"
                >
                  {SECTION_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Constraints (int / float) */}
              {(editingField.type === 'int' || editingField.type === 'float' || editingField.type === 'binary') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Min (ge)</label>
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
                    <label className="block text-xs font-medium text-gray-600 mb-1">Max (le)</label>
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">Valeurs (une par ligne)</label>
                  <textarea
                    value={editingField._literalValuesText}
                    onChange={e => setEditingField({ ...editingField, _literalValuesText: e.target.value })}
                    rows={6}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
                    placeholder="valeur 1&#10;valeur 2&#10;valeur 3"
                  />
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveField}
                disabled={!editingField.name.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {isAddingNew ? 'Ajouter' : 'Appliquer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
