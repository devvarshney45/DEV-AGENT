// src/components/ScanModal.tsx
'use client';

import React, { useState } from 'react';
import { X, Play, ShieldAlert, Sparkles, AlertTriangle, Terminal, Code2, FolderCode } from 'lucide-react';
import { Project } from '../lib/api';

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onStartScan: (params: {
    mode: 'full_scan' | 'custom';
    instruction: string;
    targetUrl?: string;
    githubUrl?: string;
    localRepoPath?: string;
    loadTestApproved: boolean;
  }) => Promise<void>;
  isSubmitting: boolean;
}

const PRESET_PROMPTS = [
  'Inspect repo for API routes, input bodies, and architectural flaws (e.g. admin signup).',
  'Audit authentication & authorization logic for BOLA / IDOR vulnerabilities.',
  'Test SQL injection, NoSQL injection, and malformed input sanitization.',
  'Audit rate-limiting, DoS resiliency, and API payload limits with 200-300 requests.',
  'Scan for sensitive data exposure, verbose stack traces, and JWT misconfigurations.',
];

export function ScanModal({
  isOpen,
  onClose,
  project,
  onStartScan,
  isSubmitting,
}: ScanModalProps) {
  const [mode, setMode] = useState<'full_scan' | 'custom'>('full_scan');
  const [instruction, setInstruction] = useState<string>(PRESET_PROMPTS[0]);
  const [targetUrl, setTargetUrl] = useState<string>('http://localhost:4000');
  const [localRepoPath, setLocalRepoPath] = useState<string>(
    project?.repository?.localPath || '/Users/store/DEV-AGENT/sentinel-ai/demo-target'
  );
  const [loadTestApproved, setLoadTestApproved] = useState<boolean>(true);

  if (!isOpen || !project) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onStartScan({
      mode,
      instruction,
      targetUrl: targetUrl.trim() || undefined,
      localRepoPath: localRepoPath.trim() || undefined,
      loadTestApproved,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-2xl rounded-2xl border border-emerald-800/80 bg-[#051108] p-6 shadow-2xl shadow-emerald-950/60 font-sans sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-emerald-900/60 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              <h2 className="text-xl font-bold text-white font-mono">Launch Autonomous Security Audit</h2>
            </div>
            <p className="mt-1 text-xs text-emerald-300/70">
              Target Project: <strong className="text-emerald-400">{project.name}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-emerald-400 hover:bg-[#0c2417] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-xs font-mono">
          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Audit Mode
            </label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div
                onClick={() => {
                  setMode('full_scan');
                  setInstruction(PRESET_PROMPTS[0]);
                }}
                className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                  mode === 'full_scan'
                    ? 'border-emerald-500 bg-[#081f12] text-white shadow-md shadow-emerald-950/40'
                    : 'border-emerald-900/50 bg-[#06140b]/50 text-emerald-400/60 hover:border-emerald-800'
                }`}
              >
                <div className="flex items-center space-x-2 font-semibold text-emerald-300">
                  <ShieldAlert className="h-4 w-4" />
                  <span>Full Code & API Audit</span>
                </div>
                <p className="mt-1.5 text-[11px] text-emerald-300/70 leading-normal font-sans">
                  Deep inspection of project files, API route discovery, body destructuring, architectural breakpoints & rate limiting.
                </p>
              </div>

              <div
                onClick={() => setMode('custom')}
                className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                  mode === 'custom'
                    ? 'border-emerald-500 bg-[#081f12] text-white shadow-md shadow-emerald-950/40'
                    : 'border-emerald-900/50 bg-[#06140b]/50 text-emerald-400/60 hover:border-emerald-800'
                }`}
              >
                <div className="flex items-center space-x-2 font-semibold text-emerald-300">
                  <Code2 className="h-4 w-4" />
                  <span>Custom Goal / Probe</span>
                </div>
                <p className="mt-1.5 text-[11px] text-emerald-300/70 leading-normal font-sans">
                  Specify exact custom objectives, fuzzing rules, or test specific endpoints under test.
                </p>
              </div>
            </div>
          </div>

          {/* Folder Path & Live Target URL */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-emerald-300">
                Local Project Folder Path
              </label>
              <input
                type="text"
                value={localRepoPath}
                onChange={(e) => setLocalRepoPath(e.target.value)}
                placeholder="/absolute/path/to/project-folder"
                className="mt-1.5 h-9 w-full rounded-lg border border-emerald-900/70 bg-[#07180e] px-3 text-xs text-white placeholder-emerald-700 focus:border-emerald-500 focus:outline-none"
              />
              <span className="mt-1 block text-[10px] text-emerald-500/70">
                Agent reads all files here to map APIs & schemas
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-300">
                Live Backend URL (To Test & Fuzz)
              </label>
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="http://localhost:4000"
                className="mt-1.5 h-9 w-full rounded-lg border border-emerald-900/70 bg-[#07180e] px-3 text-xs text-white placeholder-emerald-700 focus:border-emerald-500 focus:outline-none"
              />
              <span className="mt-1 block text-[10px] text-emerald-500/70">
                Server to probe with HTTP requests and rate limit checks
              </span>
            </div>
          </div>

          {/* Prompt / Instruction */}
          <div>
            <label className="block text-xs font-semibold text-emerald-300">
              Agent Audit Instructions
            </label>
            <textarea
              rows={2}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              required
              className="mt-1.5 w-full rounded-xl border border-emerald-900/70 bg-[#07180e] p-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Submit */}
          <div className="mt-6 flex justify-end space-x-3 border-t border-emerald-900/60 pt-4 font-sans">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-[#07170e] px-4 py-2 text-xs font-medium text-emerald-300 hover:bg-[#0c2417] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/25 hover:brightness-110 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{isSubmitting ? 'Starting...' : 'Run Agent Audit'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
