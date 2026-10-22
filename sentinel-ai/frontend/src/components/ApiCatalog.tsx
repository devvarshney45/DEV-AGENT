// src/components/ApiCatalog.tsx
'use client';

import React, { useState } from 'react';
import {
  Network,
  Lock,
  Unlock,
  Search,
  Code,
  Play,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Sliders,
  ShieldAlert,
  Activity,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { ApiEndpoint, api, EndpointTestResult, StressTestResult } from '../lib/api';

interface ApiCatalogProps {
  endpoints: ApiEndpoint[];
  projectId?: string;
  targetBaseUrl?: string;
}

export function ApiCatalog({
  endpoints,
  projectId,
  targetBaseUrl = 'http://localhost:4000',
}: ApiCatalogProps) {
  const [search, setSearch] = useState('');
  const [filterMethod, setFilterMethod] = useState('ALL');

  // Interactive Test State
  const [activeEndpoint, setActiveEndpoint] = useState<ApiEndpoint | null>(null);
  const [activeTab, setActiveTab] = useState<'single' | 'ratelimit'>('ratelimit');
  const [testUrl, setTestUrl] = useState('');
  const [testMethod, setTestMethod] = useState('GET');
  const [testBody, setTestBody] = useState('{}');
  const [authToken, setAuthToken] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<EndpointTestResult | null>(null);

  // Rate-Limit & Stress Testing State
  const [stressTesting, setStressTesting] = useState(false);
  const [stressResult, setStressResult] = useState<StressTestResult | null>(null);
  const [stressReqCount, setStressReqCount] = useState<number>(200);
  const [stressConcurrency, setStressConcurrency] = useState<number>(50);

  const filtered = endpoints.filter((ep) => {
    const matchesMethod = filterMethod === 'ALL' || ep.method.toUpperCase() === filterMethod;
    const matchesSearch =
      search === '' ||
      ep.path.toLowerCase().includes(search.toLowerCase()) ||
      (ep.sourceFile && ep.sourceFile.toLowerCase().includes(search.toLowerCase())) ||
      (ep.description && ep.description.toLowerCase().includes(search.toLowerCase()));
    return matchesMethod && matchesSearch;
  });

  const getMethodBadge = (m: string) => {
    switch (m.toUpperCase()) {
      case 'GET':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'POST':
        return 'bg-green-500/20 text-green-300 border-green-500/40';
      case 'PUT':
      case 'PATCH':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'DELETE':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      default:
        return 'bg-emerald-900/30 text-emerald-400 border-emerald-800';
    }
  };

  const setupModalForEndpoint = (ep: ApiEndpoint, defaultTab: 'single' | 'ratelimit' = 'ratelimit') => {
    setActiveEndpoint(ep);
    setActiveTab(defaultTab);
    setTestMethod(ep.method.toUpperCase());
    setTestUrl(`${targetBaseUrl}${ep.path.replace(':id', '1')}`);

    if (ep.requestBodySchema) {
      // Build realistic default values based on schema
      const defaultVals: Record<string, any> = {};
      Object.entries(ep.requestBodySchema).forEach(([k, type]) => {
        if (k.toLowerCase().includes('email')) defaultVals[k] = 'test@example.com';
        else if (k.toLowerCase().includes('password')) defaultVals[k] = 'Password123!';
        else if (k.toLowerCase().includes('role')) defaultVals[k] = 'admin';
        else if (type === 'number') defaultVals[k] = 100;
        else defaultVals[k] = 'test_value';
      });
      setTestBody(JSON.stringify(defaultVals, null, 2));
    } else if (ep.method.toUpperCase() === 'POST' || ep.method.toUpperCase() === 'PUT') {
      setTestBody('{\n  "username": "test_user",\n  "password": "Password123!"\n}');
    } else {
      setTestBody('');
    }

    setTestResult(null);
    setStressResult(null);
  };

  const handleExecuteSingleTest = async () => {
    if (!projectId) return;
    setTesting(true);
    setTestResult(null);
    try {
      let parsedBody: unknown = undefined;
      if (testBody.trim()) {
        try {
          parsedBody = JSON.parse(testBody);
        } catch {
          alert('Invalid JSON in Request Body');
          setTesting(false);
          return;
        }
      }
      const headers: Record<string, string> = {};
      if (authToken.trim()) {
        headers['Authorization'] = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
      }

      const res = await api.testEndpoint(projectId, {
        method: testMethod,
        url: testUrl,
        body: parsedBody,
        headers,
      });
      setTestResult(res);
    } catch (err: any) {
      alert(err.message || 'Test request failed');
    } finally {
      setTesting(false);
    }
  };

  const handleExecuteStressTest = async (overrideRequests?: number) => {
    if (!projectId) return;
    const reqCount = overrideRequests ?? stressReqCount;
    setStressTesting(true);
    setStressResult(null);
    try {
      let parsedBody: unknown = undefined;
      if (testBody.trim()) {
        try {
          parsedBody = JSON.parse(testBody);
        } catch {
          // ignore parsing error for stress test
        }
      }
      const headers: Record<string, string> = {};
      if (authToken.trim()) {
        headers['Authorization'] = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
      }

      const res = await api.stressTest(projectId, {
        method: testMethod,
        url: testUrl,
        requests: reqCount,
        concurrency: stressConcurrency,
        body: parsedBody,
        headers,
      });
      setStressResult(res);
    } catch (err: any) {
      alert(err.message || 'Stress test failed');
    } finally {
      setStressTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Method Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-emerald-500/70" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search API endpoints, source files, or body params..."
            className="h-9 w-full rounded-xl border border-emerald-900/60 bg-[#06140b] pl-9 pr-3 text-xs text-white placeholder-emerald-700/60 focus:border-emerald-500 focus:outline-none transition-colors"
          />
        </div>

        <div className="flex items-center space-x-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['ALL', 'GET', 'POST', 'PUT', 'DELETE'].map((m) => (
            <button
              key={m}
              onClick={() => setFilterMethod(m)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                filterMethod === m
                  ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/30'
                  : 'bg-[#06140b] text-emerald-400/80 hover:bg-[#0d2717] hover:text-white border border-emerald-900/40'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Endpoints Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-emerald-900/40 bg-[#041008] p-8 text-center">
          <Network className="mx-auto h-8 w-8 text-emerald-700" />
          <h3 className="mt-3 text-sm font-semibold text-emerald-200">No API Endpoints Detected</h3>
          <p className="mt-1 text-xs text-emerald-500/60 max-w-sm mx-auto">
            {endpoints.length === 0
              ? 'Load a project folder above and trigger an audit to automatically extract all endpoints and body schemas.'
              : 'No endpoints match your active filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-emerald-900/60 bg-[#040e07] shadow-xl shadow-emerald-950/20">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-emerald-900/70 bg-[#06170d] text-[11px] font-semibold uppercase tracking-wider text-emerald-400/80">
              <tr>
                <th className="py-3 px-4">Endpoint Route</th>
                <th className="py-3 px-4">Security Classification</th>
                <th className="py-3 px-4">Extracted Body Params</th>
                <th className="py-3 px-4">Source Code</th>
                <th className="py-3 px-4 text-right">Interactive Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-950/80 font-mono">
              {filtered.map((ep) => (
                <tr key={ep.id} className="hover:bg-[#0b2114]/60 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2.5">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold border ${getMethodBadge(
                          ep.method
                        )}`}
                      >
                        {ep.method.toUpperCase()}
                      </span>
                      <span className="font-semibold text-white">{ep.path}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 max-w-xs">
                    {ep.description ? (
                      <div className="flex items-start space-x-1.5 text-rose-400 text-[11px] leading-tight font-sans font-medium">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-rose-400" />
                        <span>{ep.description}</span>
                      </div>
                    ) : ep.authRequired ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                        <Lock className="mr-1 h-3 w-3" />
                        Auth Guarded
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-950/60 px-2.5 py-0.5 text-[10px] text-emerald-300/80 border border-emerald-800/40">
                        <Unlock className="mr-1 h-3 w-3 text-emerald-500" />
                        Public Route
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {ep.requestBodySchema ? (
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {Object.entries(ep.requestBodySchema).map(([key, val]) => (
                          <span
                            key={key}
                            className="rounded bg-[#071b0f] px-1.5 py-0.5 text-[10px] text-emerald-300 border border-emerald-800/40"
                          >
                            {key}: <span className="text-emerald-500">{String(val)}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-emerald-700/70 font-sans text-[11px]">No body params</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-emerald-400/70">
                    {ep.sourceFile ? (
                      <div className="flex items-center space-x-1">
                        <Code className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="truncate max-w-[180px]" title={ep.sourceFile}>
                          {ep.sourceFile}:{ep.sourceLine ?? 1}
                        </span>
                      </div>
                    ) : (
                      <span className="text-emerald-700">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => setupModalForEndpoint(ep, 'ratelimit')}
                        className="inline-flex items-center space-x-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 transition-all shadow-sm group"
                        title="Run rapid 200-300 req/sec rate limit stress test on this endpoint"
                      >
                        <Zap className="h-3 w-3 text-emerald-400 group-hover:text-slate-950 fill-current" />
                        <span>Rate-Limit Test</span>
                      </button>

                      <button
                        onClick={() => setupModalForEndpoint(ep, 'single')}
                        className="inline-flex items-center space-x-1 rounded-lg border border-emerald-800/60 bg-[#071a0e] px-2 py-1 text-[11px] font-medium text-emerald-400 hover:bg-[#0d2e1a] hover:text-white transition-all"
                        title="Send single request and inspect response payload"
                      >
                        <Play className="h-3 w-3 fill-current text-emerald-500" />
                        <span>Inspect</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Interactive Testing & Rate-Limit Stress Lab Modal */}
      {activeEndpoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-emerald-800/80 bg-[#051108] p-6 shadow-2xl shadow-emerald-950/60 font-sans">
            <div className="flex items-start justify-between border-b border-emerald-900/60 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-mono font-bold border ${getMethodBadge(
                      testMethod
                    )}`}
                  >
                    {testMethod}
                  </span>
                  <h3 className="text-base font-bold text-white font-mono">{activeEndpoint.path}</h3>
                </div>
                <p className="mt-1 text-xs text-emerald-300/70">
                  Interactive API Security & Rate Limit Diagnostics
                </p>
              </div>
              <button
                onClick={() => setActiveEndpoint(null)}
                className="rounded-lg p-1 text-emerald-400 hover:bg-[#0c2417] hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Sub-Tabs: Rate-Limit Stress Lab vs Single Request */}
            <div className="mt-4 flex border-b border-emerald-900/60">
              <button
                onClick={() => setActiveTab('ratelimit')}
                className={`flex items-center space-x-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
                  activeTab === 'ratelimit'
                    ? 'border-emerald-400 text-emerald-300'
                    : 'border-transparent text-emerald-600 hover:text-emerald-400'
                }`}
              >
                <Zap className="h-3.5 w-3.5 fill-current" />
                <span>Rate-Limit & Stress Lab</span>
              </button>
              <button
                onClick={() => setActiveTab('single')}
                className={`flex items-center space-x-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
                  activeTab === 'single'
                    ? 'border-emerald-400 text-emerald-300'
                    : 'border-transparent text-emerald-600 hover:text-emerald-400'
                }`}
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Single Request Inspector</span>
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs font-mono">
              {/* Target URL */}
              <div>
                <label className="block text-emerald-300 font-semibold mb-1">Target Endpoint URL</label>
                <input
                  type="text"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  className="h-9 w-full rounded-lg border border-emerald-900/70 bg-[#07180e] px-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Optional Bearer Token */}
              <div>
                <label className="block text-emerald-300 font-semibold mb-1">
                  Optional Authorization Token (Bearer)
                </label>
                <input
                  type="text"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="e.g. your_jwt_token_here (optional)"
                  className="h-8 w-full rounded-lg border border-emerald-900/70 bg-[#07180e] px-3 text-xs text-emerald-200 placeholder-emerald-800/60 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Request Body */}
              {(testMethod === 'POST' || testMethod === 'PUT' || testMethod === 'PATCH') && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-emerald-300 font-semibold">JSON Request Body</label>
                    <button
                      onClick={() => {
                        if (activeEndpoint.requestBodySchema) {
                          setTestBody(JSON.stringify(activeEndpoint.requestBodySchema, null, 2));
                        }
                      }}
                      className="text-[10px] text-emerald-400 hover:underline"
                    >
                      Reset from Schema
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={testBody}
                    onChange={(e) => setTestBody(e.target.value)}
                    className="w-full rounded-lg border border-emerald-900/70 bg-[#07180e] p-3 text-xs text-emerald-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              {/* ── TAB 1: RATE-LIMIT & STRESS TESTING LAB ── */}
              {activeTab === 'ratelimit' && (
                <div className="rounded-xl border border-emerald-800/60 bg-[#06180e] p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center space-x-1.5 font-sans">
                      <Sliders className="h-4 w-4 text-emerald-400" />
                      <span>Custom Rate-Limit Configuration</span>
                    </span>
                    <span className="text-[11px] text-emerald-400/80 font-sans">
                      Burst Testing Concurrency
                    </span>
                  </div>

                  {/* Preset Quick Selectors */}
                  <div>
                    <label className="block text-emerald-300/80 mb-1.5 text-[11px] font-sans">
                      Total Requests to Fire:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[50, 100, 200, 300, 500].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setStressReqCount(num)}
                          className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                            stressReqCount === num
                              ? 'bg-emerald-500 text-slate-950 font-bold'
                              : 'bg-[#092214] text-emerald-300 border border-emerald-800/60 hover:bg-[#0e2f1c]'
                          }`}
                        >
                          {num} reqs
                        </button>
                      ))}
                      <input
                        type="number"
                        min={10}
                        max={1000}
                        value={stressReqCount}
                        onChange={(e) => setStressReqCount(Number(e.target.value))}
                        className="h-7 w-20 rounded border border-emerald-800/80 bg-[#071a0f] px-2 text-center text-xs text-white focus:outline-none focus:border-emerald-500"
                        title="Custom request count"
                      />
                    </div>
                  </div>

                  {/* Concurrency Selector */}
                  <div>
                    <label className="block text-emerald-300/80 mb-1.5 text-[11px] font-sans">
                      Simultaneous Concurrency Workers:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[10, 25, 50, 100].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setStressConcurrency(c)}
                          className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                            stressConcurrency === c
                              ? 'bg-emerald-500 text-slate-950 font-bold'
                              : 'bg-[#092214] text-emerald-300 border border-emerald-800/60 hover:bg-[#0e2f1c]'
                          }`}
                        >
                          {c} workers
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Trigger Button */}
                  <div className="pt-2">
                    <button
                      onClick={() => handleExecuteStressTest()}
                      disabled={testing || stressTesting}
                      className="w-full flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 py-2.5 font-sans font-bold text-slate-950 hover:brightness-110 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                    >
                      {stressTesting ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Firing {stressReqCount} requests against endpoint...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4 fill-current" />
                          <span>Launch Rate-Limit Test ({stressReqCount} reqs / {stressConcurrency} concurrent)</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Stress Test Telemetry Output */}
                  {stressResult && (
                    <div className="mt-4 rounded-xl border border-emerald-500/50 bg-[#041208] p-4 font-mono space-y-3">
                      <div className="flex items-center justify-between border-b border-emerald-900/60 pb-2">
                        <span className="font-bold text-white flex items-center space-x-1.5">
                          <Activity className="h-4 w-4 text-emerald-400" />
                          <span>Real-Time Telemetry</span>
                        </span>
                        <span className="text-emerald-400 font-bold text-sm">
                          ⚡ {stressResult.reqPerSec} req/sec
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                        <div className="rounded-lg bg-[#071c0f] p-2 border border-emerald-900/60">
                          <span className="text-emerald-500/70 block">Total Requests</span>
                          <span className="font-bold text-white text-sm">{stressResult.totalRequests}</span>
                        </div>
                        <div className="rounded-lg bg-[#071c0f] p-2 border border-emerald-900/60">
                          <span className="text-emerald-500/70 block">Duration</span>
                          <span className="font-bold text-white text-sm">{stressResult.durationMs} ms</span>
                        </div>
                        <div className="rounded-lg bg-[#071c0f] p-2 border border-emerald-900/60">
                          <span className="text-emerald-500/70 block">Rate Limiter Active?</span>
                          <span className={`font-bold text-sm ${stressResult.rateLimited ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {stressResult.rateLimited ? '✓ YES (Throttled)' : '✗ NO (Vulnerable)'}
                          </span>
                        </div>
                      </div>

                      {/* Verdict Banner */}
                      <div
                        className={`p-3 rounded-lg border text-xs font-sans ${
                          stressResult.rateLimited
                            ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
                            : 'border-rose-500/40 bg-rose-950/40 text-rose-200'
                        }`}
                      >
                        <div className="flex items-center space-x-2 font-bold mb-1">
                          {stressResult.rateLimited ? (
                            <CheckCircle className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <ShieldAlert className="h-4 w-4 text-rose-400" />
                          )}
                          <span>Security Assessment Verdict</span>
                        </div>
                        <p>{stressResult.verdict}</p>
                      </div>

                      {/* HTTP Status Breakdown Badges */}
                      <div>
                        <span className="text-[11px] text-emerald-400/80 block mb-1.5">
                          HTTP Response Code Distribution:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(stressResult.statusCounts).map(([code, count]) => (
                            <span
                              key={code}
                              className={`rounded-md px-2.5 py-1 text-xs font-bold border ${
                                code === '429'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : code.startsWith('2')
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              }`}
                            >
                              HTTP {code}: {count} reqs
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 2: SINGLE FUNCTIONAL TEST INSPECTOR ── */}
              {activeTab === 'single' && (
                <div className="space-y-4">
                  <button
                    onClick={handleExecuteSingleTest}
                    disabled={testing || stressTesting}
                    className="flex items-center space-x-1.5 rounded-lg bg-emerald-500 px-4 py-2 font-sans font-bold text-slate-950 hover:bg-emerald-400 transition-colors disabled:opacity-50"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>{testing ? 'Sending Request...' : 'Send Single Request'}</span>
                  </button>

                  {testResult && (
                    <div className="rounded-xl border border-emerald-900/60 bg-[#071a0f] p-4 font-mono">
                      <div className="flex items-center justify-between border-b border-emerald-900/60 pb-2 mb-2">
                        <span className="font-bold text-white flex items-center space-x-2">
                          <span
                            className={testResult.status < 400 ? 'text-emerald-400' : 'text-rose-400'}
                          >
                            HTTP {testResult.status} {testResult.statusText}
                          </span>
                        </span>
                        <span className="text-[11px] text-emerald-500">{testResult.durationMs}ms</span>
                      </div>
                      <pre className="max-h-56 overflow-y-auto text-xs text-emerald-200/90 whitespace-pre-wrap">
                        {typeof testResult.body === 'string'
                          ? testResult.body
                          : JSON.stringify(testResult.body, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
