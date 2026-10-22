// src/components/ProjectModal.tsx
'use client';

import React, { useState, useRef } from 'react';
import { X, FolderPlus, FolderCode, UploadCloud, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectReady: (project: any, localPath?: string) => Promise<void>;
  isSubmitting: boolean;
}

export function ProjectModal({
  isOpen,
  onClose,
  onProjectReady,
  isSubmitting,
}: ProjectModalProps) {
  const [tab, setTab] = useState<'upload' | 'path'>('upload');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [localPath, setLocalPath] = useState('/Users/store/DEV-AGENT/sentinel-ai/demo-target');
  const [selectedFiles, setSelectedFiles] = useState<Array<{ path: string; content: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDirectorySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setUploading(true);
    const filesToUpload: Array<{ path: string; content: string }> = [];

    // Extract root folder name
    const firstRel = fileList[0].webkitRelativePath || '';
    const rootName = firstRel.split('/')[0] || 'My Project';
    if (!name) setName(rootName);

    const allowedExts = ['.js', '.ts', '.mjs', '.cjs', '.json', '.yaml', '.yml'];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const relPath = file.webkitRelativePath || file.name;

      // Skip node_modules, .git, etc.
      if (
        relPath.includes('node_modules/') ||
        relPath.includes('.git/') ||
        relPath.includes('.next/') ||
        relPath.includes('dist/') ||
        relPath.includes('build/')
      ) {
        continue;
      }

      const ext = relPath.slice(relPath.lastIndexOf('.')).toLowerCase();
      if (!allowedExts.includes(ext)) continue;

      try {
        const text = await file.text();
        // Skip files that are too huge
        if (text.length < 2_000_000) {
          filesToUpload.push({ path: relPath, content: text });
        }
      } catch {
        // Skip unreadable files
      }
    }

    setSelectedFiles(filesToUpload);
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (tab === 'upload') {
      if (selectedFiles.length === 0) {
        alert('Please click "Select Folder from Computer" to choose your project folder first.');
        return;
      }
      setUploading(true);
      try {
        const res = await api.uploadFolder({
          name: name.trim(),
          files: selectedFiles,
        });
        await onProjectReady(res.project, res.localPath);
        onClose();
      } catch (err: any) {
        alert(err.message || 'Folder upload failed');
      } finally {
        setUploading(false);
      }
    } else {
      // Manual path mode
      try {
        const res = await api.createProject({
          name: name.trim(),
          description: description.trim() || undefined,
          localPath: localPath.trim() || undefined,
        });
        await onProjectReady(res.project, localPath.trim());
        onClose();
      } catch (err: any) {
        alert(err.message || 'Failed to create project');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-2xl border border-emerald-800/80 bg-[#051108] p-6 shadow-2xl shadow-emerald-950/60 font-sans">
        <div className="flex items-start justify-between border-b border-emerald-900/60 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-400 border border-emerald-500/30">
              <FolderPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-mono">Select & Upload Project Folder</h2>
              <p className="text-xs text-emerald-300/70">Agent directly scans local computer memory folder</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-emerald-400 hover:bg-[#0c2417] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switch: Direct Computer Folder Select vs Manual Path */}
        <div className="mt-4 flex rounded-lg border border-emerald-900/80 bg-[#030b05] p-1 font-mono text-xs">
          <button
            type="button"
            onClick={() => setTab('upload')}
            className={`flex-1 rounded-md py-1.5 text-center font-bold transition-colors ${
              tab === 'upload'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-emerald-400/80 hover:text-white'
            }`}
          >
            Direct Folder Selector
          </button>
          <button
            type="button"
            onClick={() => setTab('path')}
            className={`flex-1 rounded-md py-1.5 text-center font-bold transition-colors ${
              tab === 'path'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-emerald-400/80 hover:text-white'
            }`}
          >
            Enter Local Path
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs font-mono">
          <div>
            <label className="block font-semibold text-emerald-200">Project Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Express API or Admin Backend"
              className="mt-1.5 h-9 w-full rounded-lg border border-emerald-900/70 bg-[#07180e] px-3 text-xs text-white placeholder-emerald-700 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {tab === 'upload' ? (
            <div>
              <label className="block font-semibold text-emerald-200 mb-2">
                Select Folder from Computer Memory
              </label>

              {/* Hidden directory input with webkitdirectory */}
              <input
                ref={fileInputRef}
                type="file"
                // @ts-ignore
                webkitdirectory=""
                directory=""
                multiple
                onChange={handleDirectorySelect}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-emerald-600/60 bg-[#071c0f]/70 p-6 text-center transition-all hover:border-emerald-400 hover:bg-[#0a2715]"
              >
                {uploading ? (
                  <div className="flex items-center space-x-2 text-emerald-300">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>Reading folder files from memory...</span>
                  </div>
                ) : selectedFiles.length > 0 ? (
                  <div className="space-y-1">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
                    <p className="font-bold text-white text-sm">
                      {selectedFiles.length} source code files loaded!
                    </p>
                    <p className="text-[11px] text-emerald-400/80">
                      Click to choose another folder if desired.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <UploadCloud className="mx-auto h-8 w-8 text-emerald-400" />
                    <p className="font-bold text-white text-sm">
                      Click to Browse & Select Project Folder
                    </p>
                    <p className="text-[11px] text-emerald-400/70 font-sans">
                      Opens OS native folder dialog. JS/TS files are read directly.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="block font-semibold text-emerald-200">
                Absolute Folder Path on Computer
              </label>
              <div className="relative mt-1.5">
                <FolderCode className="absolute left-3 top-2.5 h-4 w-4 text-emerald-500/60" />
                <input
                  type="text"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  placeholder="/Users/store/DEV-AGENT/sentinel-ai/demo-target"
                  className="h-9 w-full rounded-lg border border-emerald-900/70 bg-[#07180e] pl-9 pr-3 text-xs font-mono text-emerald-100 placeholder-emerald-700 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          )}

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
              disabled={isSubmitting || uploading || !name.trim()}
              className="rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/25 hover:brightness-110 disabled:opacity-50"
            >
              {isSubmitting || uploading ? 'Processing...' : 'Upload & Start Audit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
