import React, { useState } from 'react';
import { Sliders, Copy, Check, Download, RefreshCw, FileCode, Shield } from 'lucide-react';

export const GitOpsConfigurator: React.FC = () => {
  const [realmName, setRealmName] = useState<string>('zero-trust');
  const [clientId, setClientId] = useState<string>('apisix-client');
  const [clientSecret, setClientSecret] = useState<string>('apisix-oidc-client-super-secret-2026');
  const [rateLimitCount, setRateLimitCount] = useState<number>(10);
  const [rateLimitWindow, setRateLimitWindow] = useState<number>(60);
  const [upstreamHost, setUpstreamHost] = useState<string>('api.zerotrust.local');
  const [activeTab, setActiveTab] = useState<'apisixroute' | 'pluginconfig' | 'realmjson'>('apisixroute');
  const [copied, setCopied] = useState<boolean>(false);

  const generatedApisixRoute = `apiVersion: apisix.apache.org/v2
kind: ApisixRoute
metadata:
  name: httpbin-zero-trust-route
  namespace: demo-apps
  labels:
    app.kubernetes.io/name: apisix-route
    app.kubernetes.io/part-of: zero-trust-gateway
spec:
  http:
    - name: httpbin-protected
      match:
        hosts:
          - "${upstreamHost}"
          - "localhost"
          - "127.0.0.1"
        paths:
          - "/httpbin/*"
          - "/headers"
      plugin_config_name: zero-trust-security-policy
      plugin_config_namespace: ingress-apisix
      plugins:
        - name: proxy-rewrite
          enable: true
          config:
            regex_uri:
              - "^/httpbin/(.*)"
              - "/$1"
        - name: openid-connect
          enable: true
          config:
            client_id: "${clientId}"
            client_secret: "${clientSecret}"
            discovery: "http://keycloak.keycloak.svc.cluster.local:8080/realms/${realmName}/.well-known/openid-configuration"
            introspection_endpoint: "http://keycloak.keycloak.svc.cluster.local:8080/realms/${realmName}/protocol/openid-connect/token/introspect"
            token_endpoint: "http://keycloak.keycloak.svc.cluster.local:8080/realms/${realmName}/protocol/openid-connect/token"
            bearer_only: true
            realm: "${realmName}"
            scope: "openid profile email roles"
            set_userinfo_header: true
            set_access_token_header: true
            set_id_token_header: true
            ssl_verify: false
            timeout: 10
      upstreams:
        - name: httpbin
          port: 80`;

  const generatedPluginConfig = `apiVersion: apisix.apache.org/v2
kind: ApisixPluginConfig
metadata:
  name: zero-trust-security-policy
  namespace: ingress-apisix
spec:
  plugins:
    - name: limit-count
      enable: true
      config:
        count: ${rateLimitCount}
        time_window: ${rateLimitWindow}
        rejected_code: 429
        rejected_msg: "Too Many Requests: Rate limit exceeded for Zero-Trust API consumer."
        key_type: var
        key: remote_addr
        policy: local
        show_remaining: true
    - name: cors
      enable: true
      config:
        allow_origins: "*"
        allow_methods: "GET,POST,PUT,DELETE,PATCH,OPTIONS"
        allow_headers: "Authorization,Content-Type,X-Requested-With"
        expose_headers: "X-RateLimit-Limit,X-RateLimit-Remaining,X-RateLimit-Reset"
        max_age: 3600
        allow_credential: true
    - name: prometheus
      enable: true`;

  const generatedRealmJson = `{
  "realm": "${realmName}",
  "enabled": true,
  "displayName": "Enterprise Zero-Trust Realm",
  "sslRequired": "external",
  "clients": [
    {
      "clientId": "${clientId}",
      "name": "Apache APISIX OIDC Gateway Client",
      "enabled": true,
      "clientAuthenticatorType": "client-secret",
      "secret": "${clientSecret}",
      "bearerOnly": false,
      "standardFlowEnabled": true,
      "directAccessGrantsEnabled": true,
      "publicClient": false,
      "protocol": "openid-connect"
    }
  ]
}`;

  const currentContent = activeTab === 'apisixroute' ? generatedApisixRoute :
                         activeTab === 'pluginconfig' ? generatedPluginConfig : generatedRealmJson;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <Sliders className="w-5 h-5 text-indigo-400" />
          <h2 className="text-xl font-bold text-white">Declarative Manifest Configurator</h2>
        </div>
        <p className="text-slate-400 text-xs">
          Dynamically customize OIDC credentials, realm topology, and rate-limiting thresholds to generate validated production CRDs.
        </p>

        {/* Configuration Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Keycloak Realm Name</label>
            <input
              type="text"
              value={realmName}
              onChange={(e) => setRealmName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">OIDC Client ID</label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Confidential Client Secret</label>
            <input
              type="text"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Rate Limit Quota (Requests)</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={rateLimitCount}
              onChange={(e) => setRateLimitCount(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Time Window (Seconds)</label>
            <input
              type="number"
              min={1}
              max={3600}
              value={rateLimitWindow}
              onChange={(e) => setRateLimitWindow(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Host Domain</label>
            <input
              type="text"
              value={upstreamHost}
              onChange={(e) => setUpstreamHost(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Live Generated Preview */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('apisixroute')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'apisixroute'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              ApisixRoute CRD
            </button>
            <button
              onClick={() => setActiveTab('pluginconfig')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'pluginconfig'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              ApisixPluginConfig CRD
            </button>
            <button
              onClick={() => setActiveTab('realmjson')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'realmjson'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              realm-export.json
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied to Clipboard!' : 'Copy Config'}
          </button>
        </div>

        <div className="mt-4 bg-slate-950 p-4 rounded-lg font-mono text-xs text-slate-300 overflow-x-auto border border-slate-900 max-h-[450px]">
          <pre>{currentContent}</pre>
        </div>
      </div>
    </div>
  );
};
