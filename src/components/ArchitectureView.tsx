import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Server, 
  Database, 
  Layers, 
  Zap, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Cpu,
  KeyRound,
  Network
} from 'lucide-react';

type FlowMode = 'unauthenticated' | 'token-exchange' | 'authenticated' | 'rate-limit';

export const ArchitectureView: React.FC = () => {
  const [activeFlow, setActiveFlow] = useState<FlowMode>('authenticated');
  const [selectedNode, setSelectedNode] = useState<string>('apisix');

  return (
    <div className="space-y-8">
      {/* Header & Flow Selector */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 backdrop-blur">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Production Zero-Trust Architecture
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Topology &amp; Zero-Trust Enforcement Pipeline
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Select an execution flow below to trace packet propagation through Apache APISIX plugins, Keycloak OIDC, and upstream workloads.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveFlow('unauthenticated')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeFlow === 'unauthenticated'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1. Unauth 401 Block
            </button>
            <button
              onClick={() => setActiveFlow('token-exchange')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeFlow === 'token-exchange'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              2. Keycloak OIDC Grant
            </button>
            <button
              onClick={() => setActiveFlow('authenticated')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeFlow === 'authenticated'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              3. Verified Request 200 OK
            </button>
            <button
              onClick={() => setActiveFlow('rate-limit')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeFlow === 'rate-limit'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              4. DDoS Throttling 429
            </button>
          </div>
        </div>

        {/* Visual Interactive Diagram */}
        <div className="mt-6 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
            {/* Step 1: Client Edge */}
            <div 
              onClick={() => setSelectedNode('client')}
              className={`cursor-pointer p-4 rounded-lg border transition-all ${
                selectedNode === 'client' 
                  ? 'bg-slate-800/90 border-cyan-500 shadow-lg shadow-cyan-500/10' 
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Public Perimeter</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">Host / KinD</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  <Network className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-sm">Client Traffic</h4>
                  <p className="text-xs text-slate-400 font-mono">api.zerotrust.local:80</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 text-xs">
                {activeFlow === 'unauthenticated' && (
                  <span className="text-rose-400 flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" /> No Bearer header
                  </span>
                )}
                {activeFlow === 'token-exchange' && (
                  <span className="text-blue-400 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" /> Direct password grant
                  </span>
                )}
                {activeFlow === 'authenticated' && (
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Bearer JWT attached
                  </span>
                )}
                {activeFlow === 'rate-limit' && (
                  <span className="text-amber-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> High burst frequency
                  </span>
                )}
              </div>
            </div>

            {/* Step 2: Apache APISIX Gateway */}
            <div 
              onClick={() => setSelectedNode('apisix')}
              className={`cursor-pointer p-4 rounded-lg border transition-all md:col-span-1 ${
                selectedNode === 'apisix' 
                  ? 'bg-slate-800/90 border-red-500 shadow-lg shadow-red-500/10' 
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono uppercase tracking-wider text-red-400">Ingress Gateway</span>
                <span className="text-xs px-2 py-0.5 rounded bg-red-950/60 border border-red-900/40 text-red-300">ingress-apisix</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-sm">Apache APISIX 3.9</h4>
                  <p className="text-xs text-slate-400 font-mono">Data Plane + Ingress CRD</p>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">1. limit-count</span>
                  <span className={activeFlow === 'rate-limit' ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                    {activeFlow === 'rate-limit' ? 'DROP (429)' : 'PASS'}
                  </span>
                </div>
                <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">2. openid-connect</span>
                  <span className={activeFlow === 'unauthenticated' ? 'text-rose-400 font-bold' : activeFlow === 'rate-limit' ? 'text-slate-500' : 'text-emerald-400'}>
                    {activeFlow === 'unauthenticated' ? 'REJECT (401)' : activeFlow === 'rate-limit' ? 'BYPASS' : 'VERIFIED'}
                  </span>
                </div>
              </div>
            </div>

            {/* Step 3: Keycloak IdP */}
            <div 
              onClick={() => setSelectedNode('keycloak')}
              className={`cursor-pointer p-4 rounded-lg border transition-all ${
                selectedNode === 'keycloak' 
                  ? 'bg-slate-800/90 border-teal-500 shadow-lg shadow-teal-500/10' 
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono uppercase tracking-wider text-teal-400">Identity Provider</span>
                <span className="text-xs px-2 py-0.5 rounded bg-teal-950/60 border border-teal-900/40 text-teal-300">keycloak</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-sm">Keycloak 24 (OIDC)</h4>
                  <p className="text-xs text-slate-400 font-mono">Realm: zero-trust</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 text-xs">
                <div className="flex items-center gap-2 text-slate-300 font-mono">
                  <Database className="w-3.5 h-3.5 text-teal-400" />
                  <span>PostgreSQL 16 Storage</span>
                </div>
                <p className="text-slate-400 text-[11px] mt-1">Client: <code className="text-teal-300">apisix-client</code> (confidential)</p>
              </div>
            </div>

            {/* Step 4: Upstream Workload */}
            <div 
              onClick={() => setSelectedNode('upstream')}
              className={`cursor-pointer p-4 rounded-lg border transition-all ${
                selectedNode === 'upstream' 
                  ? 'bg-slate-800/90 border-indigo-500 shadow-lg shadow-indigo-500/10' 
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono uppercase tracking-wider text-indigo-400">Zero-Trust Upstream</span>
                <span className="text-xs px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-900/40 text-indigo-300">demo-apps</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-sm">Upstream Microservice</h4>
                  <p className="text-xs text-slate-400 font-mono">go-httpbin (Port 80)</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 text-xs">
                {activeFlow === 'authenticated' ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Receives X-Userinfo
                  </span>
                ) : (
                  <span className="text-slate-500 flex items-center gap-1 font-mono">
                    <XCircle className="w-3.5 h-3.5" /> Traffic Not Forwarded
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Active Flow Explanation Banner */}
          <div className="mt-4 p-4 rounded-lg bg-slate-950 border border-slate-800 text-sm flex items-start gap-3">
            <div className="p-1.5 rounded bg-slate-900 border border-slate-700 text-slate-300 mt-0.5">
              <ArrowRight className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <span className="font-semibold text-white">
                {activeFlow === 'unauthenticated' && 'Scenario 1: Unauthenticated Perimeter Rejection'}
                {activeFlow === 'token-exchange' && 'Scenario 2: Keycloak Direct Access Grant Token Generation'}
                {activeFlow === 'authenticated' && 'Scenario 3: Zero-Trust End-to-End Cryptographic Validation'}
                {activeFlow === 'rate-limit' && 'Scenario 4: Volumetric DDoS Defense (limit-count plugin)'}
              </span>
              <p className="text-slate-400 text-xs leading-relaxed">
                {activeFlow === 'unauthenticated' && 'A client initiates an HTTP GET request to /httpbin/headers without a Bearer token. Apache APISIX executes the openid-connect plugin in bearer_only mode, immediately returning HTTP 401 Unauthorized before any upstream compute is consumed.'}
                {activeFlow === 'token-exchange' && 'The client calls Keycloak token endpoint /realms/zero-trust/protocol/openid-connect/token using client credentials or password grant (user alice). Keycloak verifies against the PostgreSQL persistent database and issues an RS256-signed JWT Access Token.'}
                {activeFlow === 'authenticated' && 'The client provides Authorization: Bearer <jwt>. APISIX inspects the token against Keycloak discovery and JWKS endpoint, confirms cryptographic validity, injects X-Userinfo and X-Access-Token headers, and proxies the sanitized request to httpbin.'}
                {activeFlow === 'rate-limit' && 'When burst requests exceed the enterprise threshold configured in ApisixPluginConfig (10 requests per 60 seconds), the limit-count plugin immediately halts request processing at the perimeter, returning HTTP 429 Too Many Requests.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Deep Dive Details Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 text-red-400">
            <Cpu className="w-5 h-5" />
            <h3 className="font-bold text-white text-base">APISIX Ingress Controller</h3>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            Unlike legacy ingress engines, Apache APISIX uses dynamic Lua memory tables and etcd. Configuration changes to <code className="text-red-300">ApisixRoute</code> take effect with <strong>zero reload, zero dropped connections</strong> and sub-millisecond route compilation.
          </p>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
              <span className="text-slate-400">CRD Version</span>
              <span className="font-mono text-white">apisix.apache.org/v2</span>
            </div>
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
              <span className="text-slate-400">Watched Namespaces</span>
              <span className="font-mono text-emerald-400">Cluster-wide (*)</span>
            </div>
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
              <span className="text-slate-400">Data Plane Port</span>
              <span className="font-mono text-cyan-400">80 (HTTP) / 443 (TLS)</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 text-teal-400">
            <Database className="w-5 h-5" />
            <h3 className="font-bold text-white text-base">Keycloak &amp; PostgreSQL Backend</h3>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            Keycloak 24 runs in production mode backed by a persistent PostgreSQL 16 cluster. Secrets are decoupled into Kubernetes Secrets, and the <code className="text-teal-300">realm-export.json</code> is mounted via ConfigMap to bootstrap realms deterministically.
          </p>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
              <span className="text-slate-400">Auto-Import Flag</span>
              <span className="font-mono text-white">--import-realm</span>
            </div>
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
              <span className="text-slate-400">Client Type</span>
              <span className="font-mono text-amber-400">Confidential (Secret protected)</span>
            </div>
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
              <span className="text-slate-400">Token Algorithm</span>
              <span className="font-mono text-teal-400">RS256 Asymmetric Signature</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 text-emerald-400">
            <Layers className="w-5 h-5" />
            <h3 className="font-bold text-white text-base">Zero-Trust Security Principles</h3>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            Strict NIST 800-207 Zero-Trust compliance. Perimeter assumes hostile network environments: every request identity is authenticated, rate-governed, and audit-logged.
          </p>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
              <span className="text-slate-400">DDoS Throttling</span>
              <span className="font-mono text-emerald-400">10 req / 60s (limit-count)</span>
            </div>
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
              <span className="text-slate-400">Bearer Enforcement</span>
              <span className="font-mono text-emerald-400">bearer_only: true (401)</span>
            </div>
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
              <span className="text-slate-400">Credential Storage</span>
              <span className="font-mono text-emerald-400">Kubernetes Secrets Only</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
