// src/components/FindingsList.tsx
'use client';

import React, { useState } from 'react';
import { Search, AlertTriangle, ChevronRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Finding } from '../lib/api';
import { FindingDetailModal } from './FindingDetailModal';

interface FindingsListProps {
  findings: Finding[];
}

export function FindingsList({ findings }: FindingsListProps) {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFinding, setActiveFinding] = useState<Finding | null>(null);

  const filtered = findings.filter((f) => {
    const matchesSev = selectedSeverity === 'all' || f.severity.toLowerCase() === selectedSeverity.toLowerCase();
    const matchesQuery =
      searchQuery === '' ||
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSev && matchesQuery;
  });

  const getSeverityStyle = (sev: string) => {
    switch (sev.toLowerCase()) {
      case 'critical':
        return 'border-rose-500/50 bg-rose-500/15 text-rose-400';
      case 'high':
        return 'border-orange-500/50 bg-orange-500/15 text-orange-400';
      case 'medium':
        return 'border-amber-500/50 bg-amber-500/15 text-amber-400';
      case 'low':
        return 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400';
      default:
        return 'border-emerald-900 bg-[#06170d] text-emerald-300';
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Severity Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-emerald-600" />
          <input
            type="text"
            placeholder="Search architectural breakpoints, IDOR, admin flaws..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-emerald-900/60 bg-[#07170e] pl-9 pr-3 text-xs font-mono text-emerald-100 placeholder-emerald-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {['all', 'critical', 'high', 'medium', 'low'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSelectedSeverity(sev)}
              className={`rounded-lg px-2.5 py-1 text-xs font-mono font-medium capitalize transition-colors ${
                selectedSeverity === sev
                  ? 'bg-emerald-500 text-slate-950 font-bold border border-emerald-400'
                  : 'bg-[#06140b] text-emerald-400/70 border border-emerald-900/50 hover:bg-[#0c2417] hover:text-white'
              }`}
            >
              {sev}
              {sev !== 'all' && (
                <span className="ml-1.5 rounded-full bg-emerald-950 px-1.5 py-0.2 text-[10px] text-emerald-300">
                  {findings.filter((f) => f.severity.toLowerCase() === sev).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Findings List Items */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-emerald-900/50 bg-[#06140b]/30 py-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500/60" />
          <h3 className="mt-3 text-sm font-semibold text-emerald-200">No Security Flaws / Breakpoints</h3>
          <p className="mt-1 text-xs text-emerald-400/60 max-w-sm font-sans">
            {findings.length === 0
              ? 'No issues have been discovered yet. Run an audit on a project to analyze code and endpoints.'
              : 'No findings match your active filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveFinding(item)}
              className="group flex cursor-pointer items-center justify-between rounded-xl border border-emerald-900/50 bg-[#06140b]/70 p-4 transition-all duration-200 hover:border-emerald-500/60 hover:bg-[#091f11] hover:shadow-lg hover:shadow-emerald-950/40"
            >
              <div className="flex items-start space-x-3.5">
                <div
                  className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border ${getSeverityStyle(
                    item.severity
                  )}`}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${getSeverityStyle(
                        item.severity
                      )}`}
                    >
                      {item.severity}
                    </span>
                    {item.owaspRef && (
                      <span className="rounded-full border border-emerald-600/40 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                        {item.owaspRef}
                      </span>
                    )}
                    <span className="text-[11px] text-emerald-500 font-mono">
                      {item.category}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-white group-hover:text-emerald-300 transition-colors">
                    {item.title}
                  </h4>
                  <p className="line-clamp-2 text-xs text-emerald-300/70 font-sans">
                    {item.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 pl-4">
                <ChevronRight className="h-4 w-4 text-emerald-600 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-300" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details Modal */}
      <FindingDetailModal
        finding={activeFinding}
        onClose={() => setActiveFinding(null)}
      />
    </div>
  );
}
