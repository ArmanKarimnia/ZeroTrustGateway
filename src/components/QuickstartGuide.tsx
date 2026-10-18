import React, { useState } from 'react';
import { Terminal, Copy, Check, ShieldCheck, BookOpen, Layers, CheckCircle2, AlertTriangle } from 'lucide-react';

export const QuickstartGuide: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const steps = [
    {
      title: "1. Create Local KinD Cluster with Ingress Port Mappings",
      description: "Uses kind-config.yaml to bind host port 80 & 443 to the Kubernetes control-plane node.",
      cmd: "make kind-up\n# Or directly:\nkind create cluster --config kind-config.yaml --name zero-trust-gateway"
    },
    {
      title: "2. Deploy Infrastructure & Zero-Trust Manifests via GitOps",
      description: "Creates isolated namespaces, provisions non-plaintext secrets, deploys Keycloak with PostgreSQL, APISIX Ingress Controller, and ApisixRoute CRDs.",
      cmd: "make deploy\n# Or directly:\n./scripts/deploy.sh"
    },
    {
      title: "3. Run Automated Integration Verification Test Suite",
      description: "Executes curl commands to verify 401 unauthenticated drop, Keycloak token acquisition, 200 authenticated proxying, and 429 DDoS rate limiting.",
      cmd: "make test\n# Or directly:\n./scripts/test-oidc-flow.sh"
    },
    {
      title: "4. Manual cURL Testing (Step-by-Step)",
      description: "Manually verify the Zero-Trust boundary and inspect injected headers.",
      cmd: `# 1. Test unauthenticated request (Expects 401):
curl -i -H "Host: api.zerotrust.local" http://127.0.0.1/httpbin/headers

# 2. Acquire JWT Bearer Token from Keycloak:
export TOKEN=$(curl -s -X POST \\
  -H "Host: auth.zerotrust.local" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  "http://127.0.0.1/realms/zero-trust/protocol/openid-connect/token" \\
  -d "client_id=apisix-client" \\
  -d "client_secret=apisix-oidc-client-super-secret-2026" \\
  -d "grant_type=password" \\
  -d "username=alice" \\
  -d "password=Password123!" | jq -r '.access_token')

# 3. Test authenticated request (Expects 200 OK + X-Userinfo):
curl -i -H "Host: api.zerotrust.local" \\
  -H "Authorization: Bearer $TOKEN" \\
  http://127.0.0.1/httpbin/headers`
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          <h2 className="text-xl font-bold text-white">Prerequisites &amp; Step-by-Step Runbook</h2>
        </div>
        <p className="text-slate-400 text-xs">
          Deploy and test this Zero-Trust gateway locally on any machine with Docker, kubectl, Helm, and KinD installed.
        </p>

        {/* Step-by-step Command List */}
        <div className="mt-6 space-y-5">
          {steps.map((step, idx) => (
            <div key={idx} className="bg-slate-950 border border-slate-800/80 rounded-xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-mono text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  {step.title}
                </h3>
                <button
                  onClick={() => copyToClipboard(step.cmd, idx)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors self-start sm:self-auto"
                >
                  {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedIndex === idx ? 'Copied!' : 'Copy Commands'}
                </button>
              </div>

              <p className="text-xs text-slate-400 mb-3 pl-7">
                {step.description}
              </p>

              <div className="bg-slate-900/90 rounded-lg p-3.5 font-mono text-xs text-emerald-300 border border-slate-800/80 overflow-x-auto whitespace-pre">
                {step.cmd}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Production Hardening Considerations */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
        <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          Enterprise Production Hardening Blueprint
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
              Distributed Redis Rate Limiting
            </h4>
            <p className="text-slate-400 leading-relaxed">
              In this KinD reference architecture, <code className="text-indigo-300">policy: local</code> is used for self-contained demonstration. In production clusters with multiple APISIX data-plane pods, configure <code className="text-indigo-300">policy: redis</code> pointing to an authenticated Redis Sentinel or Redis Cluster to synchronize rate counters globally.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              HashiCorp Vault / External Secrets
            </h4>
            <p className="text-slate-400 leading-relaxed">
              Secrets are defined as declarative templates in <code className="text-emerald-300">k8s/base/secrets.yaml.template</code>. For automated GitOps pipelines (ArgoCD / Flux), integrate External-Secrets Operator or Bitnami SealedSecrets so credentials are encrypted at rest in Git.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              Mutual TLS (mTLS) with Istio / Linkerd
            </h4>
            <p className="text-slate-400 leading-relaxed">
              While APISIX handles perimeter OIDC validation and edge TLS termination, upstream internal cluster traffic can be encrypted with sidecar service meshes (Istio or Linkerd) or APISIX upstream mTLS certificates.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              NetworkPolicies &amp; Pod Security Standards
            </h4>
            <p className="text-slate-400 leading-relaxed">
              Workload namespaces are labeled with <code className="text-amber-300">pod-security.kubernetes.io/enforce: restricted</code>. Deploy default-deny Calico or Cilium NetworkPolicies ensuring upstream microservices only accept ingress traffic originating from APISIX data-plane pods.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
