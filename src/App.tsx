import React, { useState } from 'react';
import { 
  ShieldCheck, 
  FolderTree, 
  Terminal, 
  Sliders, 
  GitBranch, 
  BookOpen, 
  Download, 
  Lock, 
  Server, 
  CheckCircle2, 
  ExternalLink,
  Github,
  Zap,
  Layers
} from 'lucide-react';
import { ArchitectureView } from './components/ArchitectureView';
import { FileExplorer } from './components/FileExplorer';
import { OidcSimulator } from './components/OidcSimulator';
import { GitOpsConfigurator } from './components/GitOpsConfigurator';
import { CiPipelineView } from './components/CiPipelineView';
import { QuickstartGuide } from './components/QuickstartGuide';
import { downloadRepositoryZip } from './utils/zipExport';

type Tab = 'architecture' | 'files' | 'simulator' | 'configurator' | 'pipeline' | 'quickstart';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('architecture');
  const [isZipping, setIsZipping] = useState<boolean>(false);

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      await downloadRepositoryZip();
    } catch (err) {
      console.error('Failed to export repository ZIP:', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top Engineering Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-red-500 text-white shadow-md shadow-indigo-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-white text-base tracking-tight">
                  Zero-Trust API Gateway
                </h1>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                  GitOps Ready
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Apache APISIX Ingress + Keycloak OIDC on Kubernetes
              </p>
            </div>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="flex items-center gap-1 text-slate-300">
                <Server className="w-3.5 h-3.5 text-cyan-400" /> APISIX 3.9
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1 text-slate-300">
                <Lock className="w-3.5 h-3.5 text-teal-400" /> Keycloak 24
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1 text-slate-300">
                <Layers className="w-3.5 h-3.5 text-indigo-400" /> KinD v1.30
              </span>
            </div>

            <button
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isZipping ? 'Exporting...' : 'Export Repo (.zip)'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto gap-1 py-1 scrollbar-none border-t border-slate-900">
          {[
            { id: 'architecture', label: 'Architecture & Flow', icon: ShieldCheck },
            { id: 'files', label: 'Repository Files (14)', icon: FolderTree },
            { id: 'simulator', label: 'Live OIDC Simulator', icon: Terminal },
            { id: 'configurator', label: 'CRD Configurator', icon: Sliders },
            { id: 'pipeline', label: 'CI/CD KinD Workflow', icon: GitBranch },
            { id: 'quickstart', label: 'Quickstart & Testing', icon: BookOpen },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {activeTab === 'architecture' && <ArchitectureView />}
        {activeTab === 'files' && <FileExplorer />}
        {activeTab === 'simulator' && <OidcSimulator />}
        {activeTab === 'configurator' && <GitOpsConfigurator />}
        {activeTab === 'pipeline' && <CiPipelineView />}
        {activeTab === 'quickstart' && <QuickstartGuide />}
      </main>

      {/* Engineering Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Zero-Trust API Gateway: Apache APISIX &amp; Keycloak (OIDC) on Kubernetes</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span>License: Apache 2.0</span>
            <span>•</span>
            <span>GitOps Declarative Architecture</span>
            <span>•</span>
            <span>NIST SP 800-207 Aligned</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
