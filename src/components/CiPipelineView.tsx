import React, { useState } from 'react';
import { 
  GitBranch, 
  CheckCircle2, 
  Clock, 
  Terminal, 
  Play, 
  ShieldCheck, 
  Copy, 
  Check, 
  AlertCircle,
  Cpu
} from 'lucide-react';

interface PipelineStep {
  name: string;
  status: 'success' | 'running' | 'idle';
  duration: string;
  command: string;
  logs: string[];
}

export const CiPipelineView: React.FC = () => {
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(0);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);

  const steps: PipelineStep[] = [
    {
      name: "1. Helm Lint & Manifest Validation",
      status: "success",
      duration: "42s",
      command: "helm lint apisix/apisix -f helm/apisix/values.yaml && helm lint bitnami/keycloak -f helm/keycloak/values.yaml",
      logs: [
        "==> Linting apisix/apisix with values: helm/apisix/values.yaml",
        "[INFO] Chart.yaml: icon is recommended",
        "1 chart(s) linted, 0 chart(s) failed",
        "==> Linting bitnami/keycloak with values: helm/keycloak/values.yaml",
        "1 chart(s) linted, 0 chart(s) failed",
        "[Kubeconform] Validating k8s/base/ manifests against Kubernetes v1.30 schema",
        "k8s/base/namespaces.yaml - Valid",
        "k8s/base/httpbin-upstream.yaml - Valid",
        "All 3 schema validations PASSED!"
      ]
    },
    {
      name: "2. KinD Cluster Provisioning",
      status: "success",
      duration: "1m 15s",
      command: "kind create cluster --config kind-config.yaml --name zero-trust-gateway",
      logs: [
        "Creating cluster 'zero-trust-gateway' ...",
        " • Ensuring node image (kindest/node:v1.30.0) 🖼",
        " • Preparing nodes 📦",
        " • Writing configuration 📜",
        " • Starting control-plane 🕹️",
        " • Installing CNI 🔌",
        " • Installing StorageClass 💾",
        "Port mapping configured: host:80 -> node:80, host:443 -> node:443",
        "Set kubectl context to \"kind-zero-trust-gateway\"",
        "KinD cluster is READY and reachable."
      ]
    },
    {
      name: "3. Namespaces & Secret Bootstrap",
      status: "success",
      duration: "18s",
      command: "kubectl apply -f k8s/base/namespaces.yaml && kubectl create secret ...",
      logs: [
        "namespace/ingress-apisix created",
        "namespace/keycloak created",
        "namespace/demo-apps created",
        "secret/keycloak-admin-secret created (Namespace: keycloak)",
        "secret/keycloak-db-secret created (Namespace: keycloak)",
        "secret/apisix-admin-secret created (Namespace: ingress-apisix)",
        "secret/apisix-oidc-secret created (Namespace: ingress-apisix)",
        "configmap/keycloak-realm-import created (from keycloak/realm-export.json)"
      ]
    },
    {
      name: "4. Keycloak & PostgreSQL Helm Deploy",
      status: "success",
      duration: "3m 40s",
      command: "helm upgrade --install keycloak bitnami/keycloak -n keycloak -f helm/keycloak/values.yaml --wait",
      logs: [
        "Release \"keycloak\" does not exist. Installing it now.",
        "Waiting for StatefulSet keycloak-postgresql-0 ready (1/1)...",
        "PostgreSQL 16 ready on port 5432.",
        "Keycloak starting with flag: --import-realm",
        "Auto-imported realm: 'zero-trust' with client 'apisix-client' and user 'alice'",
        "Keycloak service active: http://keycloak.keycloak.svc.cluster.local:8080",
        "Keycloak deployment successfully stabilized."
      ]
    },
    {
      name: "5. APISIX Ingress Controller Helm Deploy",
      status: "success",
      duration: "2m 10s",
      command: "helm upgrade --install apisix apisix/apisix -n ingress-apisix -f helm/apisix/values.yaml --wait",
      logs: [
        "Deploying APISIX Data-Plane (2 replicas) and etcd (1 replica)...",
        "APISIX Ingress Controller listening for ApisixRoute and ApisixPluginConfig CRDs",
        "CRD established: apisixroutes.apisix.apache.org",
        "CRD established: apisixpluginconfigs.apisix.apache.org",
        "APISIX Proxy NodePort listening on port 80 (HTTP) & 443 (HTTPS)"
      ]
    },
    {
      name: "6. Deploy Upstream & ApisixRoutes",
      status: "success",
      duration: "25s",
      command: "kubectl apply -f k8s/base/httpbin-upstream.yaml && kubectl apply -f k8s/base/apisix-route-httpbin.yaml",
      logs: [
        "deployment.apps/httpbin created (Namespace: demo-apps)",
        "service/httpbin created (Namespace: demo-apps)",
        "apisixpluginconfig.apisix.apache.org/zero-trust-security-policy created",
        "apisixroute.apisix.apache.org/httpbin-zero-trust-route created",
        "apisixroute.apisix.apache.org/keycloak-ingress-route created",
        "APISIX Ingress Controller synchronized routes to etcd in 12ms."
      ]
    },
    {
      name: "7. Test Suite: 401, Token, 200, 429",
      status: "success",
      duration: "34s",
      command: "./scripts/test-oidc-flow.sh",
      logs: [
        "[TEST 1] Testing unauthenticated call -> HTTP 401 Unauthorized [PASS]",
        "[TEST 2] Requesting OIDC token for alice -> Received RS256 JWT [PASS]",
        "[TEST 3] Calling /httpbin/headers with Bearer token -> HTTP 200 OK [PASS]",
        "  - Verified header: X-Userinfo injected into upstream request",
        "[TEST 4] Burst 15 requests -> HTTP 429 Too Many Requests on req #11 [PASS]",
        "All 4 end-to-end Zero-Trust assertions passed with 100% success!"
      ]
    }
  ];

  const currentStep = steps[selectedStepIndex];

  const copyCommand = () => {
    navigator.clipboard.writeText(currentStep.command);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Pipeline Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Automated KinD CI/CD Workflow
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-indigo-400" />
              .github/workflows/ci.yml Validation Pipeline
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Deterministic verification pipeline running in Ubuntu GitHub Actions runner with Helm linting and full ephemeral KinD cluster testing.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">TOTAL DURATION</span>
              <span className="text-white font-bold">~8m 45s</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">OUTCOME</span>
              <span className="text-emerald-400 font-bold">ALL PASSED</span>
            </div>
          </div>
        </div>

        {/* Horizontal Step Flow */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mt-6">
          {steps.map((s, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedStepIndex(idx)}
              className={`p-3 rounded-lg border text-left transition-all ${
                selectedStepIndex === idx
                  ? 'bg-slate-800 border-indigo-500 shadow-md'
                  : 'bg-slate-950 border-slate-800/80 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] text-slate-500 font-mono">{s.duration}</span>
              </div>
              <div className="text-[11px] font-semibold text-white truncate">
                {s.name.split('.')[1] || s.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Step Deep Dive */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              {currentStep.name}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Command executed in Ubuntu 24.04 runner:
            </p>
          </div>

          <button
            onClick={copyCommand}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedCmd ? 'Copied!' : 'Copy Shell Command'}
          </button>
        </div>

        {/* Command Box */}
        <div className="mt-4 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-indigo-300 flex items-center justify-between">
          <code className="truncate">{currentStep.command}</code>
        </div>

        {/* Logs Console */}
        <div className="mt-4 bg-slate-950 p-4 rounded-lg border border-slate-900 font-mono text-xs text-slate-300 space-y-1.5 max-h-[360px] overflow-y-auto">
          {currentStep.logs.map((log, i) => (
            <div key={i} className={`flex items-start gap-2 ${
              log.includes('PASSED') || log.includes('PASS') || log.includes('Valid') || log.includes('ready') || log.includes('READY')
                ? 'text-emerald-400'
                : log.includes('error') || log.includes('FAIL')
                ? 'text-rose-400'
                : 'text-slate-300'
            }`}>
              <span className="text-slate-600 select-none text-[10px] w-5">❯</span>
              <span>{log}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
