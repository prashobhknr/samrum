import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import SamrumLayout from '../../components/SamrumLayout';
import TreeNav, { TreeNode } from '../../components/TreeNav';
import DataGrid, { Column, ToolbarAction } from '../../components/DataGrid';
import { getStoredToken } from '../../lib/auth';

const API = 'http://localhost:3000';

interface ObjectType extends Record<string, unknown> {
  id: number;
  database_id: string;
  name_singular: string;
  name_plural: string;
  default_attr_caption: string;
  description: string | null;
  is_abstract: boolean;
  data_type_id: number | null;
  data_type_name: string;
  classification_name: string | null;
  classification_id: number | null;
  exists_only_in_parent_scope: boolean;
}

interface ObjAttribute {
  id: number;
  caption_singular: string | null;
  caption_plural: string | null;
  to_type_id: number;
  data_type_name: string;
  min_relations: number;
  max_relations: number | null;
  allow_in_lists: boolean;
  show_in_lists_default: boolean;
  is_requirement: boolean;
  max_chars: number | null;
  copy_attribute: boolean;
  exists_only_in_parent: boolean;
  required_in_locked_version: boolean;
  sort_order: number;
}
interface ObjRelationship { id: number; caption_singular: string | null; from_name: string; to_name: string; from_type_id: number; to_type_id: number; min_relations: number; max_relations: number | null; }

interface DetailPanelProps {
  item: ObjectType | null;
  allTypes: ObjectType[];
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onNavigate: (ot: ObjectType) => void;
}

function DetailPanel({ item, allTypes, onEdit, onDelete, onClose, onNavigate }: DetailPanelProps) {
  const [view, setView] = useState<'info' | 'attributes' | 'relations'>('info');
  const [attributes, setAttributes] = useState<ObjAttribute[]>([]);
  const [relations, setRelations] = useState<ObjRelationship[]>([]);
  const [loadingAttrs, setLoadingAttrs] = useState(false);
  const [loadingRels, setLoadingRels] = useState(false);
  const [showAddAttr, setShowAddAttr] = useState(false);
  const [editingAttr, setEditingAttr] = useState<ObjAttribute | null>(null);
  const [showAddRel, setShowAddRel] = useState(false);
  const [dataTypes, setDataTypes] = useState<{ id: number; name: string }[]>([]);
  const [attrForm, setAttrForm] = useState({
    caption_singular: '', caption_plural: '', to_type_id: '1',
    is_ref_type: false, ref_type_search: '',
    is_requirement: false, allow_in_lists: true, show_in_lists_default: false,
    required_in_locked_version: false, copy_attribute: false,
    exists_only_in_parent: false, max_chars: '',
    min_relations: '0', max_relations: '',
  });
  const [relForm, setRelForm] = useState({ to_type_id: '', caption_singular: '', caption_plural: '', min_relations: '0', max_relations: '' });
  const [savingAttr, setSavingAttr] = useState(false);
  const [savingRel, setSavingRel] = useState(false);
  const [relTypeSearch, setRelTypeSearch] = useState('');
  const [editingRel, setEditingRel] = useState<ObjRelationship | null>(null);
  const [editRelForm, setEditRelForm] = useState({ caption_singular: '', caption_plural: '', min_relations: '0', max_relations: '' });
  const [savingEditRel, setSavingEditRel] = useState(false);
  const [relOrder, setRelOrder] = useState<number[]>([]);

  const getHeaders = () => {
    const token = getStoredToken();
    const h: Record<string, string> = {};
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  };

  const loadAttrs = useCallback(() => {
    if (!item) return;
    setLoadingAttrs(true);
    fetch(`${API}/api/admin/object-types/${item.id}/attributes`, { headers: getHeaders() })
      .then(r => r.json()).then(d => setAttributes(d.data ?? [])).catch(() => {}).finally(() => setLoadingAttrs(false));
  }, [item?.id]);

  const loadRels = useCallback(() => {
    if (!item) return;
    setLoadingRels(true);
    fetch(`${API}/api/admin/object-types/${item.id}/relationships`, { headers: getHeaders() })
      .then(r => r.json()).then(d => {
        const rows: ObjRelationship[] = d.data ?? [];
        setRelations(rows);
        setRelOrder(rows.map(r => r.id));
      }).catch(() => {}).finally(() => setLoadingRels(false));
  }, [item?.id]);

  useEffect(() => {
    if (!item) return;
    setView('info');
    setAttributes([]);
    setRelations([]);
    setRelOrder([]);
    setEditingRel(null);
    setRelTypeSearch('');
    setRelForm({ to_type_id: '', caption_singular: '', caption_plural: '', min_relations: '0', max_relations: '' });
  }, [item?.id]);

  useEffect(() => { if (view === 'attributes') loadAttrs(); }, [view, loadAttrs]);
  useEffect(() => {
    fetch(`${API}/api/admin/data-types`, { headers: getHeaders() })
      .then(r => r.json()).then(d => setDataTypes(d.data ?? [])).catch(() => {});
  }, []);
  useEffect(() => { if (view === 'relations') loadRels(); }, [view, loadRels]);

  const EMPTY_ATTR = {
    caption_singular: '', caption_plural: '', to_type_id: '1',
    is_ref_type: false, ref_type_search: '',
    is_requirement: false, allow_in_lists: true, show_in_lists_default: false,
    required_in_locked_version: false, copy_attribute: false,
    exists_only_in_parent: false, max_chars: '',
    min_relations: '0', max_relations: '',
  };

  const saveAttr = async () => {
    if (!item || !attrForm.caption_singular.trim()) return;
    setSavingAttr(true);
    const h = { ...getHeaders(), 'Content-Type': 'application/json' };
    const toTypeId = attrForm.is_ref_type
      ? parseInt(attrForm.to_type_id)   // object type id
      : parseInt(attrForm.to_type_id);  // data type id
    const payload = {
      to_type_id: toTypeId,
      caption_singular: attrForm.caption_singular,
      caption_plural: attrForm.caption_plural || null,
      is_requirement: attrForm.is_requirement,
      allow_in_lists: attrForm.allow_in_lists,
      show_in_lists_default: attrForm.show_in_lists_default,
      required_in_locked_version: attrForm.required_in_locked_version,
      copy_attribute: attrForm.copy_attribute,
      exists_only_in_parent: attrForm.exists_only_in_parent,
      max_chars: attrForm.max_chars ? parseInt(attrForm.max_chars) : null,
      min_relations: parseInt(attrForm.min_relations) || 0,
      max_relations: attrForm.max_relations ? parseInt(attrForm.max_relations) : null,
    };
    let url: string;
    let method: string;
    if (editingAttr) {
      url = `${API}/api/admin/object-types/attributes/${editingAttr.id}`;
      method = 'PUT';
    } else if (attrForm.is_ref_type) {
      url = `${API}/api/admin/object-types/${item.id}/relationships`;
      method = 'POST';
    } else {
      url = `${API}/api/admin/object-types/${item.id}/attributes`;
      method = 'POST';
    }
    await fetch(url, { method, headers: h, body: JSON.stringify(payload) });
    setShowAddAttr(false);
    setEditingAttr(null);
    setAttrForm(EMPTY_ATTR);
    setSavingAttr(false);
    if (attrForm.is_ref_type) loadRels(); else loadAttrs();
  };

  const openEditAttr = (attr: ObjAttribute) => {
    setEditingAttr(attr);
    setAttrForm({
      caption_singular: attr.caption_singular ?? '',
      caption_plural: attr.caption_plural ?? '',
      to_type_id: String(attr.to_type_id),
      is_ref_type: false,
      ref_type_search: '',
      is_requirement: attr.is_requirement,
      allow_in_lists: attr.allow_in_lists,
      show_in_lists_default: attr.show_in_lists_default,
      required_in_locked_version: attr.required_in_locked_version,
      copy_attribute: attr.copy_attribute,
      exists_only_in_parent: attr.exists_only_in_parent,
      max_chars: attr.max_chars != null ? String(attr.max_chars) : '',
      min_relations: String(attr.min_relations),
      max_relations: attr.max_relations != null ? String(attr.max_relations) : '',
    });
    setShowAddAttr(true);
  };

  const deleteAttr = async (id: number) => {
    if (!confirm('Radera attribut?')) return;
    await fetch(`${API}/api/admin/object-types/attributes/${id}`, { method: 'DELETE', headers: getHeaders() });
    loadAttrs();
  };

  const saveRel = async () => {
    if (!item || !relForm.to_type_id) return;
    setSavingRel(true);
    const h = { ...getHeaders(), 'Content-Type': 'application/json' };
    const payload = { to_type_id: Number(relForm.to_type_id), caption_singular: relForm.caption_singular || null, caption_plural: relForm.caption_plural || null, min_relations: Number(relForm.min_relations) || 0, max_relations: relForm.max_relations ? Number(relForm.max_relations) : null };
    await fetch(`${API}/api/admin/object-types/${item.id}/relationships`, { method: 'POST', headers: h, body: JSON.stringify(payload) });
    setShowAddRel(false);
    setRelForm({ to_type_id: '', caption_singular: '', caption_plural: '', min_relations: '0', max_relations: '' });
    setRelTypeSearch('');
    setSavingRel(false);
    loadRels();
  };

  const deleteRel = async (id: number) => {
    if (!confirm('Ta bort koppling?')) return;
    await fetch(`${API}/api/admin/object-types/relationships/${id}`, { method: 'DELETE', headers: getHeaders() });
    loadRels();
  };

  const openEditRel = (rel: ObjRelationship) => {
    setEditingRel(rel);
    setEditRelForm({
      caption_singular: rel.caption_singular ?? '',
      caption_plural: '',
      min_relations: String(rel.min_relations ?? 0),
      max_relations: rel.max_relations != null ? String(rel.max_relations) : '',
    });
  };

  const saveEditRel = async () => {
    if (!editingRel) return;
    setSavingEditRel(true);
    const h = { ...getHeaders(), 'Content-Type': 'application/json' };
    await fetch(`${API}/api/admin/object-types/relationships/${editingRel.id}`, {
      method: 'PUT', headers: h,
      body: JSON.stringify({
        caption_singular: editRelForm.caption_singular || null,
        caption_plural: editRelForm.caption_plural || null,
        min_relations: Number(editRelForm.min_relations) || 0,
        max_relations: editRelForm.max_relations ? Number(editRelForm.max_relations) : null,
      }),
    });
    setEditingRel(null);
    setSavingEditRel(false);
    loadRels();
  };

  const moveRel = (id: number, dir: -1 | 1) => {
    setRelOrder(prev => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  if (!item) return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
      <svg className="w-12 h-12 mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M9 3h6" />
      </svg>
      <p className="text-sm">Välj en objekttyp</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full text-sm">
      {/* Header */}
      <div className="px-3 py-3 border-b border-samrum-border bg-slate-50 flex items-start justify-between flex-shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-slate-400 truncate">{item.classification_name ?? 'Ej klassificerad'}</p>
          <h3 className="font-semibold text-slate-900 text-sm truncate">{item.name_singular}</h3>
          <p className="text-[10px] text-slate-400 font-mono">{item.database_id}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-2 flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-samrum-border flex-shrink-0">
        <button onClick={onEdit} className="px-2.5 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700">Ändra</button>
        <button onClick={onDelete} className="px-2.5 py-1 text-xs font-medium border border-red-200 text-red-600 rounded hover:bg-red-50">Radera</button>
        {view === 'attributes' && (
          <button onClick={() => { setEditingAttr(null); setAttrForm(EMPTY_ATTR); setShowAddAttr(true); }} className="px-2.5 py-1 text-xs font-medium border border-slate-300 text-slate-600 rounded hover:bg-slate-50">
            + Lägg till attribut
          </button>
        )}
        {view === 'relations' && (
          <button onClick={() => setShowAddRel(true)} className="px-2.5 py-1 text-xs font-medium border border-slate-300 text-slate-600 rounded hover:bg-slate-50">
            + Koppla typ
          </button>
        )}
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-samrum-border flex-shrink-0">
        {(['info', 'attributes', 'relations'] as const).map(tab => (
          <button key={tab} onClick={() => setView(tab)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${view === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {tab === 'info' ? 'Info' : tab === 'attributes' ? 'Attribut' : 'Relationer'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Info tab */}
        {view === 'info' && (
          <div className="divide-y divide-slate-100">
            {[
              ['AdministrationsId', item.database_id],
              ['Namn, singular', item.name_singular],
              ['Namn, plural', item.name_plural],
              ['Datatyp', item.data_type_name],
              ['Klassificering', item.classification_name ?? '—'],
              ['Rubrik för Id', item.default_attr_caption ?? '—'],
              ['Är abstrakt', item.is_abstract ? 'Ja' : 'Nej'],
              ['Existerar med förälder', item.exists_only_in_parent_scope ? 'Ja' : 'Nej'],
              ['Beskrivning', item.description ?? '—'],
            ].map(([label, value]) => (
              <div key={label} className="px-3 py-2.5">
                <p className="text-[10px] text-slate-400 mb-0.5">{label}</p>
                <p className="text-xs text-slate-800 font-medium break-words">{value}</p>
              </div>
            ))}
            <div className="px-3 py-3">
              <Link href={`/admin/classify`} className="text-xs text-blue-600 hover:underline">
                Visa klassificerade objekt →
              </Link>
            </div>
          </div>
        )}

        {/* Attributes tab */}
        {view === 'attributes' && (
          loadingAttrs ? <div className="px-3 py-8 text-center text-xs text-slate-400">Laddar...</div> :
          attributes.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-slate-400">
              Inga attribut definierade.<br />
              <button onClick={() => { setEditingAttr(null); setAttrForm(EMPTY_ATTR); setShowAddAttr(true); }}
                className="mt-2 text-blue-600 hover:underline">Lägg till attribut</button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {attributes.map(attr => (
                <div key={attr.id} className="px-3 py-2 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{attr.caption_singular ?? '—'}</p>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        <span className="bg-blue-50 text-blue-700 px-1.5 py-0 rounded text-[10px]">{attr.data_type_name}</span>
                        {attr.is_requirement && <span className="bg-red-50 text-red-600 px-1 py-0 rounded text-[10px]">Obligatorisk</span>}
                        {attr.show_in_lists_default && <span className="bg-green-50 text-green-700 px-1 py-0 rounded text-[10px]">Visas i lista</span>}
                        {attr.required_in_locked_version && <span className="bg-amber-50 text-amber-700 px-1 py-0 rounded text-[10px]">Låsningskrav</span>}
                        {attr.copy_attribute && <span className="bg-slate-100 text-slate-600 px-1 py-0 rounded text-[10px]">Kopieras</span>}
                        {attr.exists_only_in_parent && <span className="bg-purple-50 text-purple-700 px-1 py-0 rounded text-[10px]">Bara i förälder</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => openEditAttr(attr)} className="text-blue-500 hover:text-blue-700 text-[10px] px-1 py-0.5 border border-blue-200 rounded hover:bg-blue-50">Ändra</button>
                      <button onClick={() => deleteAttr(attr.id)} className="text-red-400 hover:text-red-600 text-[10px] px-1 py-0.5 border border-red-200 rounded hover:bg-red-50">✕</button>
                    </div>
                  </div>
                  {attr.max_chars && <p className="text-[10px] text-slate-400 mt-0.5">Max {attr.max_chars} tecken</p>}
                </div>
              ))}
            </div>
          )
        )}

        {/* Relations tab */}
        {view === 'relations' && (
          loadingRels ? <div className="px-3 py-8 text-center text-xs text-slate-400">Laddar...</div> :
          relations.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-slate-400">
              Inga relationer.<br />
              <button onClick={() => setShowAddRel(true)} className="mt-2 text-blue-600 hover:underline">Koppla till objekttyp</button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {relOrder.map((relId, idx) => {
                const rel = relations.find(r => r.id === relId);
                if (!rel) return null;
                return (
                  <div key={rel.id} className="px-2 py-2 hover:bg-slate-50 flex items-center gap-1">
                    {/* Reorder arrows */}
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button onClick={() => moveRel(rel.id, -1)} disabled={idx === 0}
                        className="text-slate-300 hover:text-slate-500 disabled:opacity-20 text-[10px] leading-none px-0.5">▲</button>
                      <button onClick={() => moveRel(rel.id, 1)} disabled={idx === relOrder.length - 1}
                        className="text-slate-300 hover:text-slate-500 disabled:opacity-20 text-[10px] leading-none px-0.5">▼</button>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{rel.caption_singular ?? '—'}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {rel.from_name} → {rel.to_name}
                        {rel.max_relations ? ` (max ${rel.max_relations})` : ' (0..∞)'}
                      </p>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {(() => {
                        const connectedId = rel.from_type_id === item.id ? rel.to_type_id : rel.from_type_id;
                        const connectedType = allTypes.find(t => t.id === connectedId);
                        return connectedType ? (
                          <button onClick={() => onNavigate(connectedType)} title={`Visa ${connectedType.name_singular}`}
                            className="text-slate-400 hover:text-blue-600 text-[10px] px-1 py-0.5 border border-slate-200 rounded hover:bg-blue-50">↗</button>
                        ) : null;
                      })()}
                      <button onClick={() => openEditRel(rel)} className="text-blue-500 hover:text-blue-700 text-[10px] px-1 py-0.5 border border-blue-200 rounded hover:bg-blue-50">Ändra</button>
                      <button onClick={() => deleteRel(rel.id)} className="text-red-400 hover:text-red-600 text-[10px] px-1 py-0.5 border border-red-200 rounded hover:bg-red-50">✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Edit Relation Modal */}
      {editingRel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-sm">Ändra relation</h3>
              <button onClick={() => setEditingRel(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="text-xs text-slate-500 bg-slate-50 rounded px-3 py-2">
                {editingRel.from_name} → {editingRel.to_name}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Benämning (singular)</label>
                  <input className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={editRelForm.caption_singular} onChange={e => setEditRelForm(f => ({ ...f, caption_singular: e.target.value }))} autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Benämning (plural)</label>
                  <input className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={editRelForm.caption_plural} onChange={e => setEditRelForm(f => ({ ...f, caption_plural: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Min</label>
                  <input type="number" min="0" className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={editRelForm.min_relations} onChange={e => setEditRelForm(f => ({ ...f, min_relations: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Max (tom = obegränsat)</label>
                  <input type="number" min="1" className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    placeholder="∞" value={editRelForm.max_relations} onChange={e => setEditRelForm(f => ({ ...f, max_relations: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <button onClick={() => setEditingRel(null)} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded">Avbryt</button>
              <button onClick={saveEditRel} disabled={savingEditRel}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                {savingEditRel ? 'Sparar...' : 'Spara'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Attribute Modal */}
      {showAddAttr && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <h3 className="font-semibold text-slate-900 text-sm">
                {editingAttr ? 'Ändra attribut' : 'Lägg till attribut'}
              </h3>
              <button onClick={() => { setShowAddAttr(false); setEditingAttr(null); }} className="text-slate-400 hover:text-slate-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">

              {/* Existerar bara med sin förälder */}
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input type="checkbox" checked={attrForm.exists_only_in_parent}
                  onChange={e => setAttrForm(f => ({ ...f, exists_only_in_parent: e.target.checked }))} className="w-3.5 h-3.5" />
                Existerar bara med sin förälder
              </label>

              {/* Namn */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Namn Singular *</label>
                  <input className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={attrForm.caption_singular}
                    onChange={e => setAttrForm(f => ({ ...f, caption_singular: e.target.value }))} autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Namn Plural</label>
                  <input className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={attrForm.caption_plural}
                    onChange={e => setAttrForm(f => ({ ...f, caption_plural: e.target.value }))} />
                </div>
              </div>

              {/* Typ av attribut */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Typ av attribut</label>
                <div className="flex gap-2 mb-2">
                  <button type="button"
                    onClick={() => setAttrForm(f => ({ ...f, is_ref_type: false, to_type_id: '1' }))}
                    className={`px-3 py-1.5 text-xs rounded border ${!attrForm.is_ref_type ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                    Datatyp
                  </button>
                  <button type="button"
                    onClick={() => setAttrForm(f => ({ ...f, is_ref_type: true, to_type_id: '', ref_type_search: '' }))}
                    className={`px-3 py-1.5 text-xs rounded border ${attrForm.is_ref_type ? 'bg-purple-600 text-white border-purple-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                    Referens till objekttyp
                  </button>
                </div>

                {!attrForm.is_ref_type ? (
                  <select className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={attrForm.to_type_id}
                    onChange={e => setAttrForm(f => ({ ...f, to_type_id: e.target.value }))}>
                    {dataTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
                  </select>
                ) : (
                  <div>
                    <input type="text" placeholder="Sök objekttyp..."
                      value={attrForm.ref_type_search}
                      onChange={e => { setAttrForm(f => ({ ...f, ref_type_search: e.target.value, to_type_id: '' })); }}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 mb-1" />
                    {attrForm.to_type_id && (
                      <p className="text-xs text-purple-700 font-medium px-1 mb-1">
                        ✓ {allTypes.find(t => String(t.id) === attrForm.to_type_id)?.name_singular}
                      </p>
                    )}
                    <div className="border border-slate-200 rounded max-h-28 overflow-y-auto bg-white">
                      {allTypes
                        .filter(t => t.id !== item.id && t.name_singular.toLowerCase().includes(attrForm.ref_type_search.toLowerCase()))
                        .slice(0, 40)
                        .map(t => (
                          <button key={t.id} type="button"
                            onClick={() => setAttrForm(f => ({ ...f, to_type_id: String(t.id), ref_type_search: t.name_singular }))}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-purple-50 transition-colors ${String(t.id) === attrForm.to_type_id ? 'bg-purple-100 text-purple-800 font-medium' : 'text-slate-700'}`}>
                            {t.name_singular}
                            {t.classification_name && <span className="text-slate-400 ml-1">· {t.classification_name}</span>}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Begränsat antal tecken (only for text-like types) */}
              {!attrForm.is_ref_type && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={!!attrForm.max_chars}
                      onChange={e => setAttrForm(f => ({ ...f, max_chars: e.target.checked ? '255' : '' }))} className="w-3.5 h-3.5" />
                    Begränsat antal tecken
                  </label>
                  {!!attrForm.max_chars && (
                    <input type="number" min="1" placeholder="Max" value={attrForm.max_chars}
                      onChange={e => setAttrForm(f => ({ ...f, max_chars: e.target.value }))}
                      className="w-20 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                  )}
                </div>
              )}

              {/* Object type reference: min/max */}
              {attrForm.is_ref_type && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Min kopplingar</label>
                    <input type="number" min="0" value={attrForm.min_relations}
                      onChange={e => setAttrForm(f => ({ ...f, min_relations: e.target.value }))}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Max (tom = ∞)</label>
                    <input type="number" min="1" value={attrForm.max_relations} placeholder="∞"
                      onChange={e => setAttrForm(f => ({ ...f, max_relations: e.target.value }))}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                  </div>
                </div>
              )}

              {/* Checkboxes grid */}
              <div className="border-t border-slate-100 pt-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Egenskaper</p>
                <div className="grid grid-cols-2 gap-y-2 gap-x-3">
                  {([
                    ['is_requirement', 'Måste anges (obligatorisk)'],
                    ['allow_in_lists', 'Kan visas i listor'],
                    ['show_in_lists_default', 'Visas standard i listor'],
                    ['required_in_locked_version', 'Krävas för låsning'],
                    ['copy_attribute', 'Kopieras vid kopiering'],
                  ] as [string, string][]).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input type="checkbox" checked={attrForm[key as keyof typeof attrForm] as boolean}
                        onChange={e => setAttrForm(f => ({ ...f, [key]: e.target.checked }))} className="w-3.5 h-3.5" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl flex-shrink-0">
              <button onClick={() => { setShowAddAttr(false); setEditingAttr(null); }} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded">Avbryt</button>
              <button onClick={saveAttr} disabled={savingAttr || !attrForm.caption_singular.trim() || (attrForm.is_ref_type && !attrForm.to_type_id)}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                {savingAttr ? 'Sparar...' : (editingAttr ? 'Spara ändringar' : 'Spara')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Relationship Modal */}
      {showAddRel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-sm">Koppla till objekttyp</h3>
              <button onClick={() => { setShowAddRel(false); setRelTypeSearch(''); }} className="text-slate-400 hover:text-slate-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Till objekttyp *</label>
                <input
                  type="text"
                  placeholder="Sök objekttyp..."
                  value={relTypeSearch}
                  onChange={e => { setRelTypeSearch(e.target.value); setRelForm(f => ({ ...f, to_type_id: '' })); }}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 mb-1"
                  autoFocus
                />
                {relForm.to_type_id && (
                  <p className="text-xs text-green-700 font-medium px-1 mb-1">
                    ✓ {allTypes.find(t => String(t.id) === relForm.to_type_id)?.name_singular}
                  </p>
                )}
                <div className="border border-slate-200 rounded max-h-36 overflow-y-auto bg-white">
                  {allTypes
                    .filter(t => t.id !== item.id && t.name_singular.toLowerCase().includes(relTypeSearch.toLowerCase()))
                    .slice(0, 50)
                    .map(t => (
                      <button key={t.id} type="button"
                        onClick={() => { setRelForm(f => ({ ...f, to_type_id: String(t.id) })); setRelTypeSearch(t.name_singular); }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors ${String(t.id) === relForm.to_type_id ? 'bg-blue-100 text-blue-800 font-medium' : 'text-slate-700'}`}>
                        {t.name_singular}
                        {t.classification_name && <span className="text-slate-400 ml-1">· {t.classification_name}</span>}
                      </button>
                    ))}
                  {allTypes.filter(t => t.id !== item.id && t.name_singular.toLowerCase().includes(relTypeSearch.toLowerCase())).length === 0 && (
                    <p className="text-xs text-slate-400 px-3 py-2">Inga träffar</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Benämning (singular)</label>
                  <input className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    placeholder="t.ex. placerad i rum"
                    value={relForm.caption_singular} onChange={e => setRelForm(f => ({ ...f, caption_singular: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Benämning (plural)</label>
                  <input className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    placeholder="t.ex. placerade i rum"
                    value={relForm.caption_plural} onChange={e => setRelForm(f => ({ ...f, caption_plural: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Min</label>
                  <input type="number" min="0" className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={relForm.min_relations} onChange={e => setRelForm(f => ({ ...f, min_relations: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Max (tom = obegränsat)</label>
                  <input type="number" min="1" className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    placeholder="∞"
                    value={relForm.max_relations} onChange={e => setRelForm(f => ({ ...f, max_relations: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <button onClick={() => { setShowAddRel(false); setRelTypeSearch(''); }} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded">Avbryt</button>
              <button onClick={saveRel} disabled={savingRel || !relForm.to_type_id}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                {savingRel ? 'Sparar...' : 'Koppla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface DataTypeOption { id: number; name: string; }
interface ClassificationOption { id: number; name: string; }

interface EditForm {
  database_id: string;
  name_singular: string;
  name_plural: string;
  default_attr_caption: string;
  description: string;
  is_abstract: boolean;
  exists_only_in_parent_scope: boolean;
  data_type_id: string;
  classification_id: string;
}

const EMPTY_FORM: EditForm = {
  database_id: '', name_singular: '', name_plural: '', default_attr_caption: '',
  description: '', is_abstract: false, exists_only_in_parent_scope: false,
  data_type_id: '', classification_id: '',
};

export default function ObjectTypesPage() {
  const router = useRouter();
  const [data, setData] = useState<ObjectType[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<ObjectType | null>(null);
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [treeSelectedId, setTreeSelectedId] = useState<string | number | null>(null);
  const [allTypesFull, setAllTypesFull] = useState<ObjectType[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editMode, setEditMode] = useState<'create' | 'edit'>('edit');
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [dataTypes, setDataTypes] = useState<DataTypeOption[]>([]);
  const [classifications, setClassifications] = useState<ClassificationOption[]>([]);

  const pageSize = 50;

  const load = useCallback((p = 1, q = '', classId?: string | null, selId?: number | null) => {
    setLoading(true);
    let url = `http://localhost:3000/api/admin/object-types?page=${p}&pageSize=${pageSize}`;
    if (q) url += `&search=${encodeURIComponent(q)}`;
    if (classId) url += `&classificationId=${encodeURIComponent(classId)}`;
    if (selId) url += `&selectedId=${selId}`;

    const token = getStoredToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;

    fetch(url, { headers })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setData(d.data ?? []);
          setTotal(d.total ?? d.data?.length ?? 0);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Build classification tree from full type list
  useEffect(() => {
    const token = getStoredToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;

    fetch('http://localhost:3000/api/admin/object-types?page=1&pageSize=1400', { headers })
      .then(r => r.json())
      .then(d => {
        if (!d.success) return;
        const all: ObjectType[] = d.data ?? [];
        setAllTypesFull(all);

        const groups: Record<string, ObjectType[]> = {};
        all.forEach(ot => {
          const key = ot.classification_name ?? 'Ej klassificerade';
          if (!groups[key]) groups[key] = [];
          groups[key].push(ot);
        });

        const nodes: TreeNode[] = [
          {
            id: 'all',
            label: `Alla objekttyper (${all.length})`,
            type: 'folder',
            children: Object.entries(groups)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([name, items]) => ({
                id: `class_${name}`,
                label: `${name} (${items.length})`,
                type: 'folder' as const,
                meta: { classificationName: name },
                children: items.map(ot => ({
                  id: ot.id,
                  label: ot.name_singular,
                  type: 'file' as const,
                  meta: ot,
                })),
              })),
          },
        ];
        setTreeNodes(nodes);
      });
  }, []);

  useEffect(() => { load(1, search, selectedFilter); }, []);

  useEffect(() => {
    const token = getStoredToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
    fetch('http://localhost:3000/api/admin/data-types', { headers })
      .then(r => r.json()).then(d => setDataTypes(d.data ?? [])).catch(() => {});
    fetch('http://localhost:3000/api/admin/classifications', { headers })
      .then(r => r.json()).then(d => setClassifications(d.data ?? [])).catch(() => {});
  }, []);

  const openEdit = (item: ObjectType) => {
    setEditForm({
      database_id: item.database_id ?? '',
      name_singular: item.name_singular ?? '',
      name_plural: item.name_plural ?? '',
      default_attr_caption: item.default_attr_caption ?? '',
      description: item.description ?? '',
      is_abstract: item.is_abstract ?? false,
      exists_only_in_parent_scope: item.exists_only_in_parent_scope ?? false,
      data_type_id: String(item.data_type_id ?? ''),
      classification_id: String(item.classification_id ?? ''),
    });
    setEditMode('edit');
    setEditOpen(true);
  };

  const openCreate = () => {
    setEditForm(EMPTY_FORM);
    setEditMode('create');
    setEditOpen(true);
  };

  const handleDeleteType = async () => {
    if (!selected) return;
    if (!confirm(`Radera objekttypen "${selected.name_singular}"? Denna åtgärd kan inte ångras.`)) return;
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`http://localhost:3000/api/admin/object-types/${selected.id}`, { method: 'DELETE', headers });
    const d = await res.json();
    if (d.success) {
      setSelected(null);
      load(page, search, selectedFilter);
    } else {
      alert(d.error ?? 'Kunde inte radera objekttypen.');
    }
  };

  const saveForm = async () => {
    setSaving(true);
    try {
      const token = getStoredToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const payload = {
        ...editForm,
        data_type_id: editForm.data_type_id ? Number(editForm.data_type_id) : null,
        classification_id: editForm.classification_id ? Number(editForm.classification_id) : null,
      };
      const url = editMode === 'edit' && selected
        ? `http://localhost:3000/api/admin/object-types/${selected.id}`
        : 'http://localhost:3000/api/admin/object-types';
      const res = await fetch(url, { method: editMode === 'edit' ? 'PUT' : 'POST', headers, body: JSON.stringify(payload) });
      const d = await res.json();
      if (d.success) {
        setEditOpen(false);
        load(page, search, selectedFilter);
        if (editMode === 'edit' && d.data) setSelected({ ...selected!, ...d.data });
      }
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<ObjectType>[] = [
    {
      key: 'database_id', header: 'AdministrationsId', sortable: true,
      render: v => <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{String(v)}</span>,
    },
    { key: 'name_singular', header: 'Namn (singular)', sortable: true },
    { key: 'name_plural', header: 'Namn (plural)', sortable: true },
    { key: 'data_type_name', header: 'Datatyp', sortable: true },
    {
      key: 'classification_name', header: 'Klassificering',
      render: v => v ? String(v) : <span className="text-slate-400 italic text-xs">Ej angiven</span>,
    },
    {
      key: 'is_abstract', header: 'Abstrakt',
      render: v => v
        ? <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">Ja</span>
        : <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Nej</span>,
    },
  ];

  const toolbar: ToolbarAction[] = [
    {
      label: 'Skapa ny', variant: 'primary',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
      onClick: openCreate,
    },
    {
      label: 'Exportera',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
      onClick: () => {
        const csv = [
          ['ID', 'AdministrationsId', 'Namn', 'Datatyp', 'Klassificering'].join(','),
          ...data.map(r => [r.id, r.database_id, r.name_singular, r.data_type_name, r.classification_name ?? ''].join(',')),
        ].join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = 'objekttyper.csv';
        a.click();
      },
    },
  ];

  const handleTreeSelect = (node: TreeNode) => {
    setTreeSelectedId(node.id);
    if (node.meta && (node.meta as Record<string, unknown>).name_singular) {
      // Leaf node: set detail panel + filter grid to show this type + its related types
      const ot = node.meta as unknown as ObjectType;
      setSelected(ot);
      setSelectedFilter(null);
      setPage(1);
      load(1, '', null, ot.id);
    } else if (node.id === 'all') {
      setSelectedFilter(null);
      setPage(1);
      load(1, search, null, null);
    } else if (String(node.id).startsWith('class_')) {
      const className = (node.meta as Record<string, unknown>)?.classificationName as string;
      setSelectedFilter(className);
      setPage(1);
      load(1, search, className, null);
    }
  };

  return (
    <SamrumLayout
      sidebar={
        <div>
          <div className="px-2 pb-2">
            <input
              type="text"
              placeholder="Filtrera träd..."
              className="w-full text-xs border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-samrum-blue/30"
            />
          </div>
          <TreeNav
            nodes={treeNodes}
            selectedId={treeSelectedId ?? undefined}
            onSelect={handleTreeSelect}
            defaultExpanded={true}
          />
        </div>
      }
      sidebarTitle="Visa som lista"
      rightPanel={
        <DetailPanel
          item={selected}
          allTypes={allTypesFull}
          onEdit={() => selected && openEdit(selected)}
          onDelete={handleDeleteType}
          onClose={() => setSelected(null)}
          onNavigate={ot => {
            setSelected(ot);
            setTreeSelectedId(ot.id);
            load(1, '', null, ot.id);
          }}
        />
      }
      rightPanelTitle="Detaljer"
      rightPanelWidth="300px"
    >
      {/* Page header */}
      <div className="px-6 py-4 bg-white border-b border-samrum-border flex-shrink-0">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <span>Admin</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium text-slate-900">Objekttyper</span>
          {selectedFilter && (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="font-medium text-slate-900 truncate max-w-[200px]">{selectedFilter}</span>
            </>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">B012 – Administrera objekttyper</h1>
            <p className="text-sm text-slate-500">
              {total.toLocaleString()} objekttyper {selectedFilter ? `i "${selectedFilter}"` : 'totalt'}
            </p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-hidden">
        <DataGrid
          columns={columns}
          data={data}
          loading={loading}
          selectable
          toolbarActions={toolbar}
          onSearch={q => { setSearch(q); setPage(1); load(1, q, selectedFilter); }}
          searchPlaceholder="Sök objekttyp..."
          onRowClick={row => router.push(`/admin/object-types/${row.id}`)}
          totalCount={total}
          page={page}
          pageSize={pageSize}
          onPageChange={p => { setPage(p); load(p, search, selectedFilter); }}
          emptyMessage="Inga objekttyper hittades"
        />
      </div>

      {/* Edit / Create Modal */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
              <h2 className="text-lg font-semibold text-slate-900">
                {editMode === 'create' ? 'Skapa ny objekttyp' : `Ändra: ${selected?.name_singular}`}
              </h2>
              <button onClick={() => setEditOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">AdministrationsId</label>
                  <input className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={editForm.database_id} onChange={e => setEditForm(f => ({ ...f, database_id: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Rubrik för Id</label>
                  <input className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={editForm.default_attr_caption} onChange={e => setEditForm(f => ({ ...f, default_attr_caption: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Namn, singular *</label>
                  <input className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={editForm.name_singular} onChange={e => setEditForm(f => ({ ...f, name_singular: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Namn, plural</label>
                  <input className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={editForm.name_plural} onChange={e => setEditForm(f => ({ ...f, name_plural: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Datatyp</label>
                  <select className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={editForm.data_type_id} onChange={e => setEditForm(f => ({ ...f, data_type_id: e.target.value }))}>
                    <option value="">— Välj datatyp —</option>
                    {dataTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Klassificering</label>
                  <select className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={editForm.classification_id} onChange={e => setEditForm(f => ({ ...f, classification_id: e.target.value }))}>
                    <option value="">— Ingen —</option>
                    {classifications.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Beskrivning</label>
                <textarea rows={3} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
                  value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={editForm.is_abstract}
                    onChange={e => setEditForm(f => ({ ...f, is_abstract: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300" />
                  Är abstrakt
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={editForm.exists_only_in_parent_scope}
                    onChange={e => setEditForm(f => ({ ...f, exists_only_in_parent_scope: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300" />
                  Existerar med förälder
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl flex-shrink-0">
              <button onClick={() => setEditOpen(false)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-200 rounded-lg">Avbryt</button>
              <button onClick={saveForm} disabled={saving || !editForm.name_singular.trim()}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50">
                {saving ? 'Sparar...' : 'Spara'}
              </button>
            </div>
          </div>
        </div>
      )}
    </SamrumLayout>
  );
}
