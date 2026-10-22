// src/components/StatsCards.tsx
'use client';

import React from 'react';
import { ShieldAlert, Bug, Network, Activity, ShieldCheck, Zap } from 'lucide-react';
import { Finding, ApiEndpoint, AgentRun } from '../lib/api';

interface StatsCardsProps {
  findings: Finding[];
  endpoints: ApiEndpoint[];
  runs: AgentRun[];
  latestRun?: AgentRun | null;
}

export function StatsCards({ findings, endpoints, runs, latestRun }: StatsCardsProps) {
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;
  const mediumCount = findings.filter((f) => f.severity === 'medium').length;
  const lowCount = findings.filter((f) => f.severity === 'low' || f.severity === 'info').length;

  // Calculate Health Score (100 - weighted vulnerabilities)
  const penalty = criticalCount * 25 + highCount * 15 + mediumCount * 5 + lowCount * 2;
  const score = Math.max(0, Math.min(100, 100 - penalty));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Security Health Score */}
      <div className="relative overflow-hidden rounded-xl border border-emerald-900/40 bg-[#06140b]/80 p-5 shadow-lg backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-medium text-emerald-400/80 uppercase tracking-wider">
            Security Posture
          </span>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 p-1.5 text-emerald-400">
            {score >= 80 ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4 text-amber-400" />}
          </div>
        </div>
        <div className="mt-3 flex items-baseline space-x-2">
          <span className="text-3xl font-bold font-mono text-emerald-400">
            {score}<span className="text-sm text-emerald-600">/100</span>
          </span>
          <span className="text-xs text-emerald-300/70">
            {score >= 85 ? 'Hardened' : score >= 60 ? 'Vulnerabilities Present' : 'Critical Breakpoints'}
          </span>
        </div>
        <div className="mt-3 h-1.5 w-full rounded-full bg-emerald-950/80">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${
              score >= 85 ? 'bg-emerald-400' : score >= 60 ? 'bg-amber-400' : 'bg-rose-500'
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Discovered APIs */}
      <div className="relative overflow-hidden rounded-xl border border-emerald-900/40 bg-[#06140b]/80 p-5 shadow-lg backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-medium text-emerald-400/80 uppercase tracking-wider">
            Discovered APIs
          </span>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 p-1.5 text-emerald-400">
            <Network className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline space-x-2">
          <span className="text-3xl font-bold font-mono text-white">
            {endpoints.length}
          </span>
          <span className="text-xs text-emerald-300/70">Routes Extracted</span>
        </div>
        <div className="mt-3 flex items-center space-x-3 text-[11px] text-emerald-300/60 font-mono">
          <span>{endpoints.filter((e) => e.authRequired).length} Auth-Guarded</span>
          <span>•</span>
          <span>{endpoints.filter((e) => !e.authRequired).length} Public Routes</span>
        </div>
      </div>

      {/* Breakpoints & Findings */}
      <div className="relative overflow-hidden rounded-xl border border-emerald-900/40 bg-[#06140b]/80 p-5 shadow-lg backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-medium text-emerald-400/80 uppercase tracking-wider">
            Architectural Flaws
          </span>
          <div className="rounded-lg border border-rose-500/30 bg-rose-950/30 p-1.5 text-rose-400">
            <Bug className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline space-x-2">
          <span className="text-3xl font-bold font-mono text-rose-400">
            {findings.length}
          </span>
          <span className="text-xs text-emerald-300/70">Breakpoints Detected</span>
        </div>
        <div className="mt-3 flex items-center space-x-2 text-[11px] font-mono">
          <span className="text-rose-400 font-semibold">{criticalCount} Crit</span>
          <span className="text-amber-400 font-semibold">{highCount} High</span>
          <span className="text-emerald-300 font-semibold">{mediumCount} Med</span>
        </div>
      </div>

      {/* Agent Activity & Runs */}
      <div className="relative overflow-hidden rounded-xl border border-emerald-900/40 bg-[#06140b]/80 p-5 shadow-lg backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-medium text-emerald-400/80 uppercase tracking-wider">
            Agent Status
          </span>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 p-1.5 text-emerald-400">
            <Activity className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline space-x-2">
          <span className="text-3xl font-bold font-mono text-emerald-400">
            {runs.length}
          </span>
          <span className="text-xs text-emerald-300/70">Total Scans Ran</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-emerald-300/60 font-mono">
          <span>Engine: {latestRun?.status ?? 'Ready'}</span>
          <span className="text-emerald-400">200-300 Req Fuzzer OK</span>
        </div>
      </div>
    </div>
  );
}
