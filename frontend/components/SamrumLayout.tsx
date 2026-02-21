import React from 'react';
import Header from './Header';

interface SamrumLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  rightPanel?: React.ReactNode;
  sidebarTitle?: string;
  rightPanelTitle?: string;
  sidebarWidth?: string;
  rightPanelWidth?: string;
  noPadding?: boolean;
}

export default function SamrumLayout({
  children,
  sidebar,
  rightPanel,
  sidebarTitle,
  rightPanelTitle,
  sidebarWidth = '260px',
  rightPanelWidth = '320px',
  noPadding = false,
}: SamrumLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-samrum-bg overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        {sidebar && (
          <aside
            className="flex flex-col bg-white border-r border-samrum-border overflow-hidden flex-shrink-0"
            style={{ width: sidebarWidth }}
          >
            {sidebarTitle && (
              <div className="px-4 py-3 border-b border-samrum-border">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {sidebarTitle}
                </h2>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-2">
              {sidebar}
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className={`flex-1 flex flex-col overflow-hidden ${noPadding ? '' : ''}`}>
          {children}
        </main>

        {/* Right Panel */}
        {rightPanel && (
          <aside
            className="flex flex-col bg-white border-l border-samrum-border overflow-hidden flex-shrink-0"
            style={{ width: rightPanelWidth }}
          >
            {rightPanelTitle && (
              <div className="px-4 py-3 border-b border-samrum-border">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {rightPanelTitle}
                </h2>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              {rightPanel}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
