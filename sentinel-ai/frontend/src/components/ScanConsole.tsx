// src/components/ScanConsole.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import { Terminal, CheckCircle2, AlertCircle, Loader2, Play, ShieldAlert, Cpu } from 'lucide-react';
import { AgentRun } from '../lib/api';

export interface ScanLog {
  id: string;
  type: 'info' | 'reasoning' | 'tool' | 'finding' | 'error' | 'success';
  message: string;
  timestamp: string;
  toolName?: string;
  toolArgs?: unknown;
}

interface ScanConsoleProps {
  activeRun: AgentRun | null;
  logs: ScanLog[];
  isScanning: boolean;
  onApproveLoadTest?: () => void;
  loadTestPending?: boolean;
}

export function ScanConsole({
  activeRun,
  logs,
  isScanning,
  onApproveLoadTest,
  loadTestPending,
}: ScanConsoleProps) {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (!activeRun && logs.length === 0) {
    return null;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse';
      case 'done':
      case 'completed':
        return 'bg-emerald-500/25 text-emerald-300 border-emerald-400';
      case 'failed':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      default:
        return 'bg-emerald-950/40 text-emerald-400 border-emerald-900';
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-900/60 bg-[#040e07] shadow-2xl shadow-emerald-950/40 font-mono">
      {/* Console Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-emerald-950 bg-[#06140b]/90 px-4 py-3 sm:px-6">
        <div className="flex items-center space-x-3">
          <div className="flex space-x-1.5">
            <div className="h-3 w-3 rounded-full bg-emerald-700/80" />
            <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
            <div className="h-3 w-3 rounded-full bg-green-400 animate-pulse" />
          </div>
          <div className="flex items-center space-x-2 border-l border-emerald-900/60 pl-3">
            <Cpu className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-200">
              SentinelAI Autonomous Agent Execution Terminal
            </span>
          </div>
        </div>

        {activeRun && (
          <div className="flex items-center space-x-3 text-xs">
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wider font-bold ${getStatusBadge(
                activeRun.status
              )}`}
            >
              {activeRun.status}
            </span>
            <span className="text-emerald-400/80">
              Progress: <strong className="text-emerald-300">{activeRun.progress}%</strong>
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {activeRun && (
        <div className="h-1 w-full bg-emerald-950/40">
          <div
            className={`h-1 transition-all duration-300 ${
              activeRun.status === 'failed'
                ? 'bg-rose-500'
                : activeRun.status === 'completed' || activeRun.status === 'done'
                ? 'bg-emerald-400'
                : 'bg-gradient-to-r from-emerald-500 to-green-400 animate-pulse'
            }`}
            style={{ width: `${Math.max(activeRun.progress, 5)}%` }}
          />
        </div>
      )}

      {/* Terminal Output */}
      <div className="max-h-96 min-h-[220px] overflow-y-auto p-4 sm:p-5 text-xs leading-relaxed text-emerald-200/90 space-y-2">
        {logs.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-emerald-700">
            {isScanning ? (
              <span className="flex items-center space-x-2 text-emerald-400">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                <span>Reading project files, analyzing AST routes, and executing security probes...</span>
              </span>
            ) : (
              <span>Agent activity stream will output here during audit execution.</span>
            )}
          </div>
        ) : (
          logs.map((log) => {
            const time = new Date(log.timestamp).toLocaleTimeString();
            return (
              <div key={log.id} className="flex items-start space-x-2.5">
                <span className="text-[10px] text-emerald-600/70 select-none">[{time}]</span>
                <div className="flex-1">
                  {log.type === 'reasoning' && (
                    <span className="text-emerald-300">
                      <strong className="text-emerald-400">[REASONING]</strong> {log.message}
                    </span>
                  )}
                  {log.type === 'tool' && (
                    <span className="text-green-300">
                      <strong className="text-green-400">[TOOL: {log.toolName ?? 'executor'}]</strong>{' '}
                      {log.message}
                    </span>
                  )}
                  {log.type === 'finding' && (
                    <span className="text-rose-400">
                      <strong className="text-rose-500 font-bold">[BREAKPOINT / FLAW]</strong> {log.message}
                    </span>
                  )}
                  {log.type === 'error' && (
                    <span className="text-rose-400">
                      <strong>[ERROR]</strong> {log.message}
                    </span>
                  )}
                  {log.type === 'success' && (
                    <span className="text-emerald-300 font-bold">
                      <strong className="text-emerald-400">[SUCCESS]</strong> {log.message}
                    </span>
                  )}
                  {log.type === 'info' && <span className="text-emerald-200">{log.message}</span>}
                </div>
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
