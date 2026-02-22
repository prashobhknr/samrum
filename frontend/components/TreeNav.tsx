import React, { useState } from 'react';

export interface TreeNode {
  id: string | number;
  label: string;
  type?: 'folder' | 'file';
  children?: TreeNode[];
  badge?: string | number;
  meta?: Record<string, unknown>;
}

interface TreeNavProps {
  nodes: TreeNode[];
  selectedId?: string | number;
  onSelect?: (node: TreeNode) => void;
  defaultExpanded?: boolean;
  className?: string;
}

function FolderIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4 text-samrum-tree flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <path d="M2 6a2 2 0 012-2h5l2 2h7a2 2 0 012 2v1H2V6zm0 4h20v10a2 2 0 01-2 2H4a2 2 0 01-2-2V10z"/>
    </svg>
  ) : (
    <svg className="w-4 h-4 text-samrum-tree flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
    </svg>
  );
}

function FileIcon() {
  return (
    <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3 h-3 text-slate-400 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
    </svg>
  );
}

function TreeNodeItem({
  node, depth, selectedId, onSelect, defaultExpanded,
}: {
  node: TreeNode;
  depth: number;
  selectedId?: string | number;
  onSelect?: (node: TreeNode) => void;
  defaultExpanded?: boolean;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isFolder = node.type === 'folder' || hasChildren;
  const [open, setOpen] = useState(defaultExpanded || depth === 0);
  const isSelected = selectedId === node.id;

  const handleClick = () => {
    if (isFolder) setOpen(o => !o);
    onSelect?.(node);
  };

  return (
    <div>
      <div
        onClick={handleClick}
        className={`flex items-center gap-1.5 py-1.5 px-2 rounded cursor-pointer transition-colors text-sm
          ${isSelected
            ? 'bg-samrum-selected text-samrum-selected-text font-medium'
            : 'text-slate-700 hover:bg-slate-100'}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {isFolder && (
          <span className="flex-shrink-0">
            <ChevronIcon open={open} />
          </span>
        )}
        {!isFolder && <span className="w-3 flex-shrink-0" />}
        {isFolder ? <FolderIcon open={open} /> : <FileIcon />}
        <span className="truncate flex-1">{node.label}</span>
        {node.badge !== undefined && (
          <span className="bg-slate-200 text-slate-600 text-xs rounded-full px-1.5 py-0.5 flex-shrink-0">
            {node.badge}
          </span>
        )}
      </div>

      {isFolder && open && node.children && (
        <div>
          {node.children.map(child => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              defaultExpanded={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TreeNav({ nodes, selectedId, onSelect, defaultExpanded = true, className = '' }: TreeNavProps) {
  return (
    <div className={`overflow-y-auto ${className}`}>
      {nodes.map(node => (
        <TreeNodeItem
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          defaultExpanded={defaultExpanded}
        />
      ))}
    </div>
  );
}
