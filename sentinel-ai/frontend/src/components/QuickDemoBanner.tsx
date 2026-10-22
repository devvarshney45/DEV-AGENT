// src/components/QuickDemoBanner.tsx
'use client';

import React from 'react';
import { ShieldAlert, Play, Flame, FolderCode, Zap } from 'lucide-react';

interface QuickDemoBannerProps {
  onQuickDemo: () => void;
  isScanning: boolean;
}

export function QuickDemoBanner({ onQuickDemo, isScanning }: QuickDemoBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-[#04140a]/90 via-[#071c0f]/80 to-[#041208]/90 p-5 shadow-xl backdrop-blur-sm sm:p-6">
      <div className="absolute right-0 top-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="relative flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
              Autonomous Code & API Testing Engine
            </span>
          </div>
          <h2 className="text-lg font-bold text-white sm:text-xl font-mono">
            Feed Project Folder → Auto-Extract APIs & Detect Architectural Breakpoints
          </h2>
          <p className="max-w-2xl text-xs text-emerald-200/80 leading-relaxed font-sans">
            Give the agent any backend folder path. It parses all JS/TS files, maps routes, body schemas, and flags architectural break points like <span className="text-emerald-300 font-bold underline">Admin Signup APIs</span> (where anyone can self-register as admin) and lets you test any API or run <span className="text-emerald-300 font-bold">200–300 req/sec stress tests</span> in 1 click.
          </p>
        </div>

        <button
          onClick={onQuickDemo}
          disabled={isScanning}
          className="group flex flex-shrink-0 items-center space-x-2 rounded-xl bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 px-5 py-3 text-xs font-bold text-slate-950 shadow-xl shadow-emerald-500/25 transition-all hover:scale-105 hover:brightness-110 disabled:opacity-50 disabled:scale-100"
        >
          <Zap className="h-4 w-4 text-slate-950 fill-current group-hover:animate-bounce" />
          <span>{isScanning ? 'Scan in Progress...' : 'Run Audit on Demo Folder'}</span>
        </button>
      </div>
    </div>
  );
}
