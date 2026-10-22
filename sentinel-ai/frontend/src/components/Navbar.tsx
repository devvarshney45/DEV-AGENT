// src/components/Navbar.tsx
'use client';

import React from 'react';
import { Shield, Radio, Plus, Terminal, RefreshCw, Zap } from 'lucide-react';
import { Project } from '../lib/api';

interface NavbarProps {
  projects: Project[];
  selectedProject: Project | null;
  onSelectProject: (project: Project) => void;
  onOpenNewProject: () => void;
  onOpenScanModal: () => void;
  isScanning: boolean;
  onRefresh: () => void;
}

export function Navbar({
  projects,
  selectedProject,
  onSelectProject,
  onOpenNewProject,
  onOpenScanModal,
  isScanning,
  onRefresh,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-emerald-900/40 bg-[#040d07]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand & Logo */}
        <div className="flex items-center space-x-3.5">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 via-emerald-400 to-green-300 p-0.5 shadow-lg shadow-emerald-500/20">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#030905]">
              <Shield className="h-5 w-5 text-emerald-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-lg font-bold tracking-wider text-white">
                SENTINEL<span className="text-emerald-400">AI</span>
              </span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                ZERO-AUTH MODE
              </span>
            </div>
            <p className="text-[11px] text-emerald-200/60 font-sans hidden sm:block">
              Autonomous Backend Security, API Inspector & Stress Testing Agent
            </p>
          </div>
        </div>

        {/* Project Selector & Actions */}
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          {/* Project Switcher */}
          <div className="relative hidden md:block">
            <select
              value={selectedProject?.id || ''}
              onChange={(e) => {
                const found = projects.find((p) => p.id === e.target.value);
                if (found) onSelectProject(found);
              }}
              className="h-9 w-52 rounded-lg border border-emerald-900/60 bg-[#07170e] px-3 text-xs font-mono font-medium text-emerald-100 shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {projects.length === 0 ? (
                <option value="">No projects loaded</option>
              ) : (
                projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            onClick={onOpenNewProject}
            title="Import or Load Project Folder"
            className="flex h-9 items-center space-x-1.5 rounded-lg border border-emerald-800/60 bg-[#081a10] px-3 text-xs font-medium text-emerald-200 transition-colors hover:border-emerald-500 hover:bg-[#0c2417] hover:text-white"
          >
            <Plus className="h-3.5 w-3.5 text-emerald-400" />
            <span>Load Folder / Repo</span>
          </button>

          <button
            onClick={onRefresh}
            title="Refresh Scan Results"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-800/60 bg-[#081a10] text-emerald-400 transition-colors hover:border-emerald-500 hover:bg-[#0c2417] hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          {/* Launch Scan CTA */}
          <button
            onClick={onOpenScanModal}
            disabled={!selectedProject || isScanning}
            className="group relative flex h-9 items-center space-x-2 rounded-lg bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 px-4 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:brightness-110 hover:shadow-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isScanning ? (
              <>
                <Radio className="h-3.5 w-3.5 animate-spin text-slate-950" />
                <span>Auditing...</span>
              </>
            ) : (
              <>
                <Terminal className="h-3.5 w-3.5 text-slate-950" />
                <span>Run Agent Audit</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
