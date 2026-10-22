// src/components/FindingDetailModal.tsx
'use client';

import React from 'react';
import { X, ShieldAlert, Terminal, Lightbulb } from 'lucide-react';
import { Finding } from '../lib/api';

interface FindingDetailModalProps {
  finding: Finding | null;
  onClose: () => void;
}

export function FindingDetailModal({ finding, onClose }: FindingDetailModalProps) {
  if (!finding) return null;

  const severityBadge = (sev: string) => {
    switch (sev.toLowerCase()) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'high':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'medium':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-emerald-800/80 bg-[#051108] p-6 shadow-2xl shadow-emerald-950/60 sm:p-8 font-sans">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-emerald-900/60 pb-5">
          <div className="space-y-2 pr-6">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-mono font-semibold uppercase tracking-wide ${severityBadge(
                  finding.severity
                )}`}
              >
                {finding.severity}
              </span>
              {finding.owaspRef && (
                <span className="rounded-full border border-emerald-600/40 bg-emerald-950/40 px-2.5 py-0.5 text-xs font-mono text-emerald-300">
                  {finding.owaspRef}
                </span>
              )}
              <span className="rounded-full border border-emerald-900/80 bg-[#07180e] px-2.5 py-0.5 text-xs font-mono text-emerald-400">
                {finding.category}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white sm:text-2xl">{finding.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-emerald-400 hover:bg-[#0c2417] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="mt-6 space-y-6 text-sm">
          {/* Description */}
          <div className="rounded-xl border border-emerald-900/50 bg-[#06140b]/60 p-4">
            <h3 className="mb-2 flex items-center text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400">
              <ShieldAlert className="mr-1.5 h-4 w-4 text-rose-400" />
              Breakpoint Analysis & Impact
            </h3>
            <p className="leading-relaxed text-emerald-100/90 whitespace-pre-wrap">{finding.description}</p>
          </div>

          {/* Evidence */}
          {finding.evidence ? (
            <div className="rounded-xl border border-emerald-900/60 bg-[#040e07] p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400">
                  <Terminal className="mr-1.5 h-4 w-4" />
                  Reproduction Evidence / Response Output
                </h3>
              </div>
              <pre className="max-h-60 overflow-x-auto rounded-lg bg-[#020703] p-3 font-mono text-xs text-emerald-300 border border-emerald-950">
                {typeof finding.evidence === 'string'
                  ? finding.evidence
                  : JSON.stringify(finding.evidence, null, 2)}
              </pre>
            </div>
          ) : null}

          {/* Remediation */}
          {finding.recommendation && (
            <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4">
              <h3 className="mb-2 flex items-center text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400">
                <Lightbulb className="mr-1.5 h-4 w-4" />
                Architectural Fix & Remediation Recommendation
              </h3>
              <p className="leading-relaxed text-emerald-200/90 whitespace-pre-wrap">
                {finding.recommendation}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end border-t border-emerald-900/60 pt-4 font-mono">
          <button
            onClick={onClose}
            className="rounded-lg bg-[#07170e] border border-emerald-800/60 px-5 py-2 text-xs font-medium text-emerald-200 hover:bg-[#0c2417] hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
