import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const API = 'http://localhost:3000';

export type AdminSection = 'databases' | 'modules' | 'object-types' | 'classifications' | 'import-export' | 'users';

interface TreeChild { id: number | string; label: string; href: string; }

const ROOT_SECTIONS: { key: AdminSection; label: string; href: string }[] = [
  { key: 'databases', label: 'Projektdatabaser', href: '/admin/databases' },
  { key: 'modules', label: 'Moduler', href: '/admin/modules' },
  { key: 'object-types', label: 'Objekttyper', href: '/admin/object-types' },
  { key: 'classifications', label: 'Klassifikationer', href: '/admin/classifications' },
  { key: 'import-export', label: 'Import/Export', href: '/admin/import-export' },
];

const IMPORT_EXPORT_CHILDREN = [
  { id: 'id-sets', label: 'ID-Uppsättningar', href: '/admin/import-export/id-sets' },
  { id: 'definitions', label: 'Definitioner', href: '/admin/import-export/definitions' },
];

function FolderIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <path d="M2 6a2 2 0 012-2h5l2 2h7a2 2 0 012 2v1H2V6zm0 4h20v10a2 2 0 01-2 2H4a2 2 0 01-2-2V10z" />
    </svg>
  ) : (
    <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`w-3 h-3 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

interface AdminTreeNavProps {
  activeSection: AdminSection;
  selectedId?: number | string;
}

// Tree item for hierarchical navigation
interface HierarchicalNode {
  id: string | number;
  label: string;
  href: string;
  type: 'folder' | 'file';
  children?: HierarchicalNode[];
}

function RecursiveMenuItem({
  node,
  depth,
  selectedId,
  router
}: {
  node: HierarchicalNode;
  depth: number;
  selectedId?: string | number;
  router: any;
}) {
  const [open, setOpen] = useState(false);
  const isSelected = String(selectedId) === String(node.id);
  const hasChildren = node.children && node.children.length > 0;

  const handleClick = (e: React.MouseEvent) => {
    if (hasChildren) {
      setOpen(!open);
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div>
      <Link href={node.href}
        className={`flex items-center gap-2 pr-3 py-1.5 text-sm cursor-pointer rounded mx-1 transition-colors
          ${isSelected
            ? 'bg-samrum-selected text-samrum-selected-text font-medium'
            : 'text-slate-600 hover:bg-slate-100'}`}
        style={{ paddingLeft: `${depth * 12 + 24}px` }}
        onClick={handleClick}
      >
        {hasChildren && <ChevronIcon open={open} />}
        {!hasChildren && <span className="w-3" />}
        {node.type === 'folder' ? <FolderIcon open={open} /> : <DocIcon />}
        <span className="truncate flex-1">{node.label}</span>
      </Link>

      {open && hasChildren && node.children?.map(child => (
        <RecursiveMenuItem
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          router={router}
        />
      ))}
    </div>
  );
}

export default function AdminTreeNav({ activeSection, selectedId }: AdminTreeNavProps) {
  const router = useRouter();
  const [dbChildren, setDbChildren] = useState<TreeChild[]>([]);
  const [moduleTree, setModuleTree] = useState<HierarchicalNode[]>([]);
  const [openSections, setOpenSections] = useState<Set<AdminSection>>(new Set([activeSection]));

  // Load project databases for B010 section
  useEffect(() => {
    fetch(`${API}/api/admin/projects`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setDbChildren(d.data.map((p: { id: number; name: string }) => ({
            id: p.id,
            label: p.name,
            href: `/admin/databases/${p.id}`,
          })));
        }
      }).catch(() => { });
  }, []);

  // Load module hierarchy for B011 section
  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/admin/modules`).then(r => r.json()),
      fetch(`${API}/api/admin/module-folders`).then(r => r.json()),
    ]).then(([mRes, fRes]) => {
      if (mRes.success && fRes.success) {
        const folders = fRes.data;
        const modules = mRes.data;

        const folderMap: Record<number, HierarchicalNode> = {};
        const roots: HierarchicalNode[] = [];

        folders.forEach((f: any) => {
          folderMap[f.id] = {
            id: `f_${f.id}`,
            label: f.name,
            href: '#', // Folders are primarily for expansion
            type: 'folder',
            children: []
          };
        });

        folders.forEach((f: any) => {
          if (f.parent_id && folderMap[f.parent_id]) {
            folderMap[f.parent_id].children!.push(folderMap[f.id]);
          } else {
            roots.push(folderMap[f.id]);
          }
        });

        modules.forEach((m: any) => {
          const node: HierarchicalNode = {
            id: m.id,
            label: m.name,
            href: `/admin/modules/${m.id}`,
            type: 'file'
          };
          if (m.folder_id && folderMap[m.folder_id]) {
            folderMap[m.folder_id].children!.push(node);
          } else {
            roots.push(node);
          }
        });

        setModuleTree(roots);
      }
    }).catch(() => { });
  }, []);

  const toggle = (key: AdminSection) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const hasDynamicChildren = (key: AdminSection): boolean => {
    return key === 'databases' || key === 'import-export' || key === 'modules';
  };

  return (
    <div className="overflow-y-auto h-full py-2">
      {ROOT_SECTIONS.map(section => {
        const isActive = activeSection === section.key;
        const isOpen = openSections.has(section.key);
        const canExpand = hasDynamicChildren(section.key);

        return (
          <div key={section.key}>
            <div
              className={`flex items-center gap-1.5 px-3 py-2 cursor-pointer select-none rounded mx-1
                ${isActive ? 'bg-amber-100 text-amber-900 font-semibold' : 'text-slate-700 hover:bg-slate-100'}`}
              onClick={() => {
                toggle(section.key);
                if (!isActive) router.push(section.href);
              }}
            >
              {canExpand ? <ChevronIcon open={isOpen} /> : <span className="w-3" />}
              <FolderIcon open={isOpen && isActive} />
              <span className="text-sm truncate">{section.label}</span>
            </div>

            {isOpen && isActive && section.key === 'databases' && dbChildren.map(child => (
              <Link key={child.id} href={child.href}
                className={`flex items-center gap-2 pl-8 pr-3 py-1.5 text-sm cursor-pointer rounded mx-1
                  ${String(selectedId) === String(child.id)
                    ? 'bg-samrum-selected text-samrum-selected-text font-medium'
                    : 'text-slate-600 hover:bg-slate-100'}`}>
                <DocIcon />
                <span className="truncate">{child.label}</span>
              </Link>
            ))}

            {isOpen && isActive && section.key === 'modules' && moduleTree.map(node => (
              <RecursiveMenuItem
                key={node.id}
                node={node}
                depth={0}
                selectedId={selectedId}
                router={router}
              />
            ))}

            {isOpen && isActive && section.key === 'import-export' && IMPORT_EXPORT_CHILDREN.map(child => (
              <Link key={child.id} href={child.href}
                className={`flex items-center gap-2 pl-8 pr-3 py-1.5 text-sm cursor-pointer rounded mx-1
                  ${String(selectedId) === String(child.id)
                    ? 'bg-samrum-selected text-samrum-selected-text font-medium'
                    : 'text-slate-600 hover:bg-slate-100'}`}>
                <DocIcon />
                <span className="truncate">{child.label}</span>
              </Link>
            ))}

            {isOpen && isActive && section.key === 'databases' && dbChildren.length === 0 && (
              <p className="pl-8 pr-3 py-1.5 text-xs text-slate-400 italic">Inga databaser</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
