// src/app/page.tsx
'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Shield,
  Layers,
  Network,
  Bug,
  Activity,
  Plus,
  Terminal,
  AlertTriangle,
  Radio,
  ExternalLink,
  ChevronRight,
  FolderCode,
} from 'lucide-react';
import { api, Project, Finding, ApiEndpoint, AgentRun } from '../lib/api';
import { Navbar } from '../components/Navbar';
import { StatsCards } from '../components/StatsCards';
import { FindingsList } from '../components/FindingsList';
import { ApiCatalog } from '../components/ApiCatalog';
import { SecurityCharts } from '../components/SecurityCharts';
import { ScanConsole, ScanLog } from '../components/ScanConsole';
import { ScanModal } from '../components/ScanModal';
import { ProjectModal } from '../components/ProjectModal';
import { QuickDemoBanner } from '../components/QuickDemoBanner';

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [activeRun, setActiveRun] = useState<AgentRun | null>(null);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [loadTestPending, setLoadTestPending] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'apis' | 'findings' | 'analytics' | 'runs'>('apis');

  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch Projects (Zero-Auth mode: backend auto-resolves default local user)
  const fetchProjects = useCallback(async () => {
    try {
      const res = await api.getProjects();
      setProjects(res.projects);
      if (res.projects.length > 0 && !selectedProject) {
        setSelectedProject(res.projects[0]);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Fetch Project Data when selectedProject changes
  const fetchProjectData = useCallback(async (projectId: string) => {
    try {
      const [fRes, epRes, rRes] = await Promise.all([
        api.getFindings(projectId).catch(() => ({ findings: [] })),
        api.getApis(projectId).catch(() => ({ endpoints: [] })),
        api.getRuns(projectId).catch(() => ({ runs: [] })),
      ]);

      setFindings(fRes.findings);
      setEndpoints(epRes.endpoints);
      setRuns(rRes.runs);

      const runningScan = rRes.runs.find((r) => r.status === 'running' || r.status === 'pending');
      if (runningScan) {
        setActiveRun(runningScan);
        setIsScanning(true);
      }
    } catch (err) {
      console.error('Error fetching project data:', err);
    }
  }, []);

  useEffect(() => {
    if (selectedProject?.id) {
      fetchProjectData(selectedProject.id);
    }
  }, [selectedProject, fetchProjectData]);

  // SSE Live Streaming for active run
  useEffect(() => {
    if (!selectedProject || !activeRun || activeRun.status === 'completed' || activeRun.status === 'done' || activeRun.status === 'failed') {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      return;
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5001';
    const token = typeof window !== 'undefined' ? localStorage.getItem('sentinel_token') : null;
    const sseUrl = `${API_URL}/api/projects/${selectedProject.id}/runs/${activeRun.id}/stream${
      token ? `?token=${encodeURIComponent(token)}` : ''
    }`;

    try {
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);

          if (data.status) {
            setActiveRun((prev) => (prev ? { ...prev, ...data } : null));

            if (data.status === 'completed' || data.status === 'done' || data.status === 'failed') {
              setIsScanning(false);
              fetchProjectData(selectedProject.id);
              es.close();
            }
          }

          if (data.currentStep || data.step || data.message || data.thought) {
            const newLog: ScanLog = {
              id: Math.random().toString(),
              type: data.type ?? (data.thought ? 'reasoning' : data.finding ? 'finding' : 'info'),
              message: data.currentStep || data.thought || data.step || data.message || JSON.stringify(data),
              timestamp: new Date().toISOString(),
              toolName: data.tool,
              toolArgs: data.args,
            };
            setScanLogs((prev) => [...prev, newLog]);
          }

          if (data.loadTestPending) {
            setLoadTestPending(true);
          }
        } catch {
          // Ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
      };
    } catch {
      // Fallback
    }

    // Polling fallback
    const interval = setInterval(async () => {
      try {
        const res = await api.getRun(selectedProject.id, activeRun.id);
        setActiveRun(res.run);
        if (res.run.status === 'completed' || res.run.status === 'done' || res.run.status === 'failed') {
          setIsScanning(false);
          clearInterval(interval);
          fetchProjectData(selectedProject.id);
        }
      } catch {
        // Ignore
      }
    }, 2500);
    pollingTimerRef.current = interval;

    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [selectedProject, activeRun, fetchProjectData]);

  // Start Scan Action
  const handleStartScan = async (params: {
    mode: 'full_scan' | 'custom';
    instruction: string;
    targetUrl?: string;
    githubUrl?: string;
    localRepoPath?: string;
    loadTestApproved: boolean;
  }) => {
    if (!selectedProject) return;
    setIsSubmitting(true);
    setScanLogs([]);

    try {
      const res = await api.startScan(selectedProject.id, params);
      setIsScanning(true);
      setActiveRun({
        id: res.agentRunId,
        mode: params.mode,
        instruction: params.instruction,
        status: 'running',
        progress: 10,
        iterations: 0,
        toolCalls: 0,
        createdAt: new Date().toISOString(),
      });

      setScanLogs([
        {
          id: '1',
          type: 'info',
          message: `Scan job dispatched [Run ID: ${res.agentRunId}]. Reading repository and mapping endpoints...`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to launch scan');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1-Click Demo Folder Audit
  const handleQuickDemo = async () => {
    try {
      setIsSubmitting(true);
      let demoProj = projects.find((p) => p.name.includes('Demo Target') || p.name.includes('demo-target'));

      if (!demoProj) {
        const created = await api.createProject({
          name: 'Demo Target Backend (Port 4000)',
          description: 'Local demo target application with intentional OWASP vulnerabilities and architectural breakpoints.',
          localPath: '/Users/store/DEV-AGENT/sentinel-ai/demo-target',
        });
        demoProj = created.project;
        setProjects((prev) => [created.project, ...prev]);
      }

      setSelectedProject(demoProj);

      await handleStartScan({
        mode: 'full_scan',
        instruction: 'Inspect demo-target repository files, extract all API endpoints & body parameters, discover admin signup breakpoints, and audit rate limiting.',
        targetUrl: 'http://localhost:4000',
        localRepoPath: '/Users/store/DEV-AGENT/sentinel-ai/demo-target',
        loadTestApproved: true,
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to launch demo');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create / Import Project Action
  const handleCreateProject = async (data: {
    name: string;
    description?: string;
    githubUrl?: string;
    localPath?: string;
  }) => {
    setIsSubmitting(true);
    try {
      const res = await api.createProject(data);
      setProjects((prev) => [res.project, ...prev]);
      setSelectedProject(res.project);

      // Auto trigger scan on import
      await handleStartScan({
        mode: 'full_scan',
        instruction: 'Inspect code, extract all routes and body parameters, audit for admin signup breakpoints and rate limiters.',
        targetUrl: 'http://localhost:4000',
        localRepoPath: data.localPath,
        githubUrl: data.githubUrl,
        loadTestApproved: true,
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030905] text-[#e2f5e8] font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Navigation Bar */}
      <Navbar
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={setSelectedProject}
        onOpenNewProject={() => setIsProjectModalOpen(true)}
        onOpenScanModal={() => setIsScanModalOpen(true)}
        isScanning={isScanning}
        onRefresh={() => selectedProject && fetchProjectData(selectedProject.id)}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Hero Quick Demo Banner */}
        <QuickDemoBanner onQuickDemo={handleQuickDemo} isScanning={isScanning} />

        {/* Real-time Agent Execution Terminal Stream */}
        {(isScanning || activeRun || scanLogs.length > 0) && (
          <ScanConsole
            activeRun={activeRun}
            logs={scanLogs}
            isScanning={isScanning}
            loadTestPending={loadTestPending}
            onApproveLoadTest={() => {
              setLoadTestPending(false);
              if (selectedProject) {
                handleStartScan({
                  mode: 'full_scan',
                  instruction: 'Continue audit with approved load testing.',
                  loadTestApproved: true,
                });
              }
            }}
          />
        )}

        {/* Stats Metrics Cards */}
        <StatsCards
          findings={findings}
          endpoints={endpoints}
          runs={runs}
          latestRun={activeRun ?? runs[0]}
        />

        {/* Visual Analytics */}
        <SecurityCharts findings={findings} />

        {/* Tab Navigation */}
        <div className="border-b border-emerald-950">
          <nav className="flex space-x-6 text-xs font-mono font-semibold">
            <button
              onClick={() => setActiveTab('apis')}
              className={`flex items-center space-x-2 border-b-2 py-3 transition-colors ${
                activeTab === 'apis'
                  ? 'border-emerald-400 text-emerald-400 font-bold'
                  : 'border-transparent text-emerald-600 hover:border-emerald-800 hover:text-emerald-300'
              }`}
            >
              <Network className="h-4 w-4" />
              <span>Extracted APIs & Schemas ({endpoints.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('findings')}
              className={`flex items-center space-x-2 border-b-2 py-3 transition-colors ${
                activeTab === 'findings'
                  ? 'border-emerald-400 text-emerald-400 font-bold'
                  : 'border-transparent text-emerald-600 hover:border-emerald-800 hover:text-emerald-300'
              }`}
            >
              <Bug className="h-4 w-4" />
              <span>Architectural Breakpoints ({findings.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('runs')}
              className={`flex items-center space-x-2 border-b-2 py-3 transition-colors ${
                activeTab === 'runs'
                  ? 'border-emerald-400 text-emerald-400 font-bold'
                  : 'border-transparent text-emerald-600 hover:border-emerald-800 hover:text-emerald-300'
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>Agent Runs & Audits ({runs.length})</span>
            </button>
          </nav>
        </div>

        {/* Tab Panels */}
        <div>
          {activeTab === 'apis' && (
            <ApiCatalog
              endpoints={endpoints}
              projectId={selectedProject?.id}
              targetBaseUrl="http://localhost:4000"
            />
          )}

          {activeTab === 'findings' && <FindingsList findings={findings} />}

          {activeTab === 'runs' && (
            <div className="space-y-3 font-mono text-xs">
              {runs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-emerald-900/50 py-12 text-center text-emerald-600">
                  No scan runs recorded for this project yet.
                </div>
              ) : (
                runs.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-xl border border-emerald-950 bg-[#06140b]/70 p-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] uppercase font-bold ${
                            r.status === 'done' || r.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : r.status === 'failed'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 animate-pulse'
                          }`}
                        >
                          {r.status}
                        </span>
                        <span className="font-semibold text-white">{r.mode.toUpperCase()}</span>
                      </div>
                      <p className="text-emerald-300/80 font-sans text-xs">{r.instruction}</p>
                    </div>

                    <div className="text-right text-[11px] text-emerald-500 space-y-0.5">
                      <div>Tools Invocations: {r.toolCalls}</div>
                      <div>{new Date(r.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <ScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        project={selectedProject}
        onStartScan={handleStartScan}
        isSubmitting={isSubmitting}
      />

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onProjectReady={async (proj: any, path?: string) => {
          setProjects((prev) => [proj, ...prev]);
          setSelectedProject(proj);
          await handleStartScan({
            mode: 'full_scan',
            instruction: 'Inspect code, extract all routes and body parameters, audit for admin signup breakpoints and rate limiters.',
            targetUrl: 'http://localhost:4000',
            localRepoPath: path,
            loadTestApproved: true,
          });
        }}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
