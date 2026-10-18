import React, { useState } from 'react';
import { 
  FileCode, 
  FolderTree, 
  Copy, 
  Check, 
  Download, 
  Search, 
  Terminal, 
  FileText, 
  ShieldAlert,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { REPOSITORY_FILES, RepoFile } from '../data/repositoryFiles';
import { downloadRepositoryZip } from '../utils/zipExport';

export const FileExplorer: React.FC = () => {
  const [selectedFilePath, setSelectedFilePath] = useState<string>('k8s/base/apisix-route-httpbin.yaml');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [copied, setCopied] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  const filteredFiles = REPOSITORY_FILES.filter(file => {
    const matchesCategory = categoryFilter === 'all' || file.category === categoryFilter;
    const matchesSearch = file.path.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          file.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const activeFile: RepoFile = REPOSITORY_FILES.find(f => f.path === selectedFilePath) || REPOSITORY_FILES[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingle = () => {
    const blob = new Blob([activeFile.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllZip = async () => {
    try {
      setIsZipping(true);
      await downloadRepositoryZip();
    } catch (e) {
      console.error('Failed to generate zip', e);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-indigo-400" />
            Repository Files &amp; Production Manifests
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Browse all declarative Kubernetes manifests, Helm overrides, Keycloak exports, and CI/CD pipelines.
          </p>
        </div>

        <button
          onClick={handleDownloadAllZip}
          disabled={isZipping}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {isZipping ? 'Bundling .zip...' : 'Download Complete Repo (.zip)'}
        </button>
      </div>

      {/* Main File Explorer Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: File Tree */}
        <div className="lg:col-span-4 bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col h-[700px]">
          {/* Search Box */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search manifests & files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-2 mb-3 text-[11px] border-b border-slate-800/80">
            {['all', 'k8s', 'helm', 'workflow', 'keycloak', 'scripts'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded capitalize whitespace-nowrap transition-colors ${
                  categoryFilter === cat
                    ? 'bg-indigo-500/20 text-indigo-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat === 'workflow' ? 'CI/CD' : cat}
              </button>
            ))}
          </div>

          {/* File List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {filteredFiles.map((file) => {
              const isSelected = file.path === selectedFilePath;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFilePath(file.path)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-slate-800 border-indigo-500/60 shadow-sm'
                      : 'bg-slate-950/40 border-slate-800/60 hover:bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <FileCode className={`w-4 h-4 mt-0.5 shrink-0 ${
                    file.language === 'yaml' ? 'text-cyan-400' :
                    file.language === 'json' ? 'text-amber-400' :
                    file.language === 'bash' ? 'text-emerald-400' : 'text-slate-400'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-mono truncate ${isSelected ? 'text-white font-semibold' : 'text-slate-300'}`}>
                        {file.name}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-900 text-slate-400">
                        {file.language}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5 font-mono">
                      {file.path}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 flex justify-between items-center">
            <span>{filteredFiles.length} of {REPOSITORY_FILES.length} files</span>
            <span className="font-mono text-emerald-400">GitOps Ready</span>
          </div>
        </div>

        {/* Right Pane: Code Viewer */}
        <div className="lg:col-span-8 bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col h-[700px]">
          {/* File Metadata Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-white">
                  {activeFile.path}
                </span>
                <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                  {activeFile.category}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {activeFile.description}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
              <button
                onClick={handleDownloadSingle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                title="Download this manifest"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
            </div>
          </div>

          {/* Syntax Highlighted Code Box with Line Numbers */}
          <div className="flex-1 overflow-auto bg-slate-950 rounded-lg p-4 font-mono text-xs text-slate-300 mt-4 leading-relaxed border border-slate-900 select-text">
            <pre className="table w-full">
              {activeFile.content.split('\n').map((line, index) => (
                <div key={index} className="table-row hover:bg-slate-900/50">
                  <span className="table-cell select-none text-right pr-4 text-slate-600 text-[11px] w-10">
                    {index + 1}
                  </span>
                  <span className="table-cell whitespace-pre">
                    {/* Syntax highlight comments and keys */}
                    {line.startsWith('#') || line.startsWith('//') ? (
                      <span className="text-slate-500 italic">{line}</span>
                    ) : line.includes(':') && !line.startsWith(' ') ? (
                      <span>
                        <span className="text-indigo-400 font-semibold">{line.split(':')[0]}:</span>
                        <span className="text-emerald-300">{line.slice(line.indexOf(':') + 1)}</span>
                      </span>
                    ) : line.includes('apiVersion:') || line.includes('kind:') ? (
                      <span className="text-cyan-300 font-bold">{line}</span>
                    ) : (
                      line
                    )}
                  </span>
                </div>
              ))}
            </pre>
          </div>

          {/* Bottom Security Note */}
          <div className="mt-3 pt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Declarative GitOps compliant: No hardcoded production passwords in CRDs.</span>
            </div>
            <span className="font-mono text-slate-500">{activeFile.content.split('\n').length} lines</span>
          </div>
        </div>
      </div>
    </div>
  );
};
