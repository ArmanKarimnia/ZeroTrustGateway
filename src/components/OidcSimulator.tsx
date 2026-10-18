import React, { useState } from 'react';
import { 
  Play, 
  Terminal, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert, 
  Key, 
  Zap, 
  RotateCcw, 
  Eye, 
  Lock,
  ArrowRight,
  Clock,
  Sparkles
} from 'lucide-react';

interface SimulatedResponse {
  statusCode: number;
  statusText: string;
  latencyMs: number;
  headers: Record<string, string>;
  body: any;
}

export const OidcSimulator: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [token, setToken] = useState<string | null>(null);
  const [showJwtDecoder, setShowJwtDecoder] = useState<boolean>(false);
  const [rateLimitCounter, setRateLimitCounter] = useState<number>(0);
  const [rateLimitWindowStart, setRateLimitWindowStart] = useState<number>(Date.now());
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [lastResponse, setLastResponse] = useState<SimulatedResponse | null>(null);
  const [isRunningBurst, setIsRunningBurst] = useState<boolean>(false);

  const RATE_LIMIT_MAX = 10;
  const RATE_LIMIT_WINDOW_SEC = 60;

  const appendLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setConsoleLogs(prev => [...prev.slice(-20), `[${timestamp}] ${msg}`]);
  };

  // Step 1: Unauthenticated Request
  const runUnauthenticatedTest = () => {
    appendLog('curl -i -H "Host: api.zerotrust.local" http://127.0.0.1/httpbin/headers');
    const resp: SimulatedResponse = {
      statusCode: 401,
      statusText: 'Unauthorized',
      latencyMs: 14,
      headers: {
        'Server': 'APISIX/3.9.1',
        'Content-Type': 'application/json; charset=utf-8',
        'WWW-Authenticate': 'Bearer realm="zero-trust"',
        'Connection': 'keep-alive',
      },
      body: {
        message: 'Missing Bearer token or authorization header',
        error: 'unauthorized_request',
        gateway: 'apisix.ingress.internal'
      }
    };
    setLastResponse(resp);
    appendLog('<- HTTP/1.1 401 Unauthorized (Blocked by openid-connect plugin in bearer_only mode)');
  };

  // Step 2: Request Keycloak Token (Direct Access Grant)
  const runTokenFetch = () => {
    appendLog('POST /realms/zero-trust/protocol/openid-connect/token (grant_type=password, username=alice)');
    
    // Realistic Base64 JWT Access Token
    const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "apisix-key-2026-v1" }));
    const payload = btoa(JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 300,
      iat: Math.floor(Date.now() / 1000),
      jti: "b59a933f-2199-4d9a-9e66-f483c6b291d4",
      iss: "http://auth.zerotrust.local/realms/zero-trust",
      aud: "apisix-client",
      sub: "7c98b671-55b2-48df-9a84-8a4e32057d62",
      typ: "Bearer",
      azp: "apisix-client",
      session_state: "02dafbe5-1cd3-4d37-9121-963262201d0c",
      preferred_username: "alice",
      email: "alice@zerotrust.example.com",
      email_verified: true,
      realm_access: {
        roles: ["api-consumer", "api-admin", "offline_access"]
      },
      resource_access: {
        "apisix-client": {
          roles: ["read-workloads", "execute-rpc"]
        }
      },
      scope: "openid profile email roles"
    }));
    const signature = "c3VwZXItc2VjdXJlLXJzMjU2LXNpZ25hdHVyZS1mb3ItemVyby10cnVzdA";
    const generatedToken = `${header}.${payload}.${signature}`;

    setToken(generatedToken);
    const resp: SimulatedResponse = {
      statusCode: 200,
      statusText: 'OK',
      latencyMs: 42,
      headers: {
        'Server': 'Keycloak/24.0.5',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache'
      },
      body: {
        access_token: generatedToken,
        expires_in: 300,
        refresh_expires_in: 1800,
        token_type: 'Bearer',
        id_token: `id_${generatedToken.slice(0, 30)}...`,
        'not-before-policy': 0,
        scope: 'openid profile email roles'
      }
    };
    setLastResponse(resp);
    appendLog('<- HTTP/1.1 200 OK: Keycloak issued signed RS256 JWT Access Token!');
  };

  // Step 3: Authenticated Request with Bearer Token
  const runAuthenticatedTest = () => {
    if (!token) {
      appendLog('ERROR: Please obtain a token in Step 2 first!');
      return;
    }

    const now = Date.now();
    let currentCount = rateLimitCounter;
    if (now - rateLimitWindowStart > RATE_LIMIT_WINDOW_SEC * 1000) {
      currentCount = 0;
      setRateLimitWindowStart(now);
    }

    if (currentCount >= RATE_LIMIT_MAX) {
      // 429
      const resp: SimulatedResponse = {
        statusCode: 429,
        statusText: 'Too Many Requests',
        latencyMs: 4,
        headers: {
          'Server': 'APISIX/3.9.1',
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': '24'
        },
        body: {
          error: 'Too Many Requests: Rate limit exceeded for Zero-Trust API consumer.',
          rejected_by: 'limit-count',
          limit: RATE_LIMIT_MAX,
          window_seconds: RATE_LIMIT_WINDOW_SEC
        }
      };
      setLastResponse(resp);
      appendLog('<- HTTP/1.1 429 Too Many Requests (APISIX limit-count tripped!)');
      return;
    }

    const nextCount = currentCount + 1;
    setRateLimitCounter(nextCount);

    appendLog(`curl -i -H "Authorization: Bearer ${token.slice(0, 15)}..." http://127.0.0.1/httpbin/headers`);
    const resp: SimulatedResponse = {
      statusCode: 200,
      statusText: 'OK',
      latencyMs: 18,
      headers: {
        'Server': 'APISIX/3.9.1',
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
        'X-RateLimit-Remaining': String(RATE_LIMIT_MAX - nextCount),
        'X-RateLimit-Reset': '45',
      },
      body: {
        headers: {
          'Accept': '*/*',
          'Host': 'api.zerotrust.local',
          'User-Agent': 'curl/8.4.0',
          'Authorization': `Bearer ${token.slice(0, 20)}...`,
          'X-Access-Token': token,
          'X-Userinfo': JSON.stringify({
            sub: "7c98b671-55b2-48df-9a84-8a4e32057d62",
            preferred_username: "alice",
            email: "alice@zerotrust.example.com",
            roles: ["api-consumer", "api-admin"]
          })
        },
        origin: '10.244.0.1',
        url: 'http://api.zerotrust.local/headers',
        message: 'Successfully reached upstream httpbin microservice via Zero-Trust gateway!'
      }
    };
    setLastResponse(resp);
    appendLog(`<- HTTP/1.1 200 OK (Identity verified, X-Userinfo injected, ${RATE_LIMIT_MAX - nextCount} calls remaining)`);
  };

  // Step 4: Rapid Burst Rate Limit Test
  const triggerBurstRateLimit = async () => {
    if (!token) {
      runTokenFetch();
    }
    setIsRunningBurst(true);
    appendLog('Initiating burst attack (15 rapid concurrent requests)...');

    let count = rateLimitCounter;
    for (let i = 1; i <= 12; i++) {
      count++;
      if (count > RATE_LIMIT_MAX) {
        appendLog(`Burst Request #${i}: -> HTTP 429 Too Many Requests (Rate limit tripped!)`);
        setRateLimitCounter(count);
        setLastResponse({
          statusCode: 429,
          statusText: 'Too Many Requests',
          latencyMs: 3,
          headers: {
            'Server': 'APISIX/3.9.1',
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
            'X-RateLimit-Remaining': '0',
          },
          body: {
            error: 'Too Many Requests: Rate limit exceeded for Zero-Trust API consumer.',
            rejected_by: 'limit-count',
            threshold: RATE_LIMIT_MAX
          }
        });
        break;
      } else {
        appendLog(`Burst Request #${i}: -> HTTP 200 OK (Remaining: ${RATE_LIMIT_MAX - count})`);
        setRateLimitCounter(count);
      }
      await new Promise(r => setTimeout(r, 60));
    }
    setIsRunningBurst(false);
  };

  const resetSimulator = () => {
    setRateLimitCounter(0);
    setRateLimitWindowStart(Date.now());
    setLastResponse(null);
    appendLog('Simulator reset: Rate limit counter cleared to 0.');
  };

  return (
    <div className="space-y-6">
      {/* Simulation Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-2">
              <Terminal className="w-3.5 h-3.5" />
              Live Gateway Test Console
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Zero-Trust OIDC &amp; Rate-Limiting Sandbox
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Step through the exact integration test sequence executed by the GitHub Actions CI workflow in the KinD cluster.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] text-slate-400">Rate Limit Quota</div>
              <div className="text-xs font-mono font-bold text-white">
                <span className={rateLimitCounter >= RATE_LIMIT_MAX ? 'text-amber-400' : 'text-emerald-400'}>
                  {rateLimitCounter}
                </span> / {RATE_LIMIT_MAX} req (60s)
              </div>
            </div>

            <button
              onClick={resetSimulator}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors border border-slate-700"
              title="Reset Rate Limit Counter"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 4 Interactive Test Steps */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-6">
          <div 
            onClick={() => { setActiveStep(1); runUnauthenticatedTest(); }}
            className={`cursor-pointer p-4 rounded-xl border transition-all ${
              activeStep === 1 
                ? 'bg-rose-950/30 border-rose-500/60 shadow-lg shadow-rose-900/20' 
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-mono text-slate-400">STEP 1</span>
              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono">401 Check</span>
            </div>
            <h4 className="font-semibold text-white text-sm">Unauthenticated Call</h4>
            <p className="text-xs text-slate-400 mt-1">Send curl without Bearer token to verify APISIX boundary drops request.</p>
            <button className="mt-3 w-full py-1.5 px-3 rounded bg-rose-600/30 hover:bg-rose-600/40 text-rose-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
              <Play className="w-3 h-3" /> Test 401 Block
            </button>
          </div>

          <div 
            onClick={() => { setActiveStep(2); runTokenFetch(); }}
            className={`cursor-pointer p-4 rounded-xl border transition-all ${
              activeStep === 2 
                ? 'bg-blue-950/30 border-blue-500/60 shadow-lg shadow-blue-900/20' 
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-mono text-slate-400">STEP 2</span>
              <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-mono">OIDC Grant</span>
            </div>
            <h4 className="font-semibold text-white text-sm">Acquire Keycloak JWT</h4>
            <p className="text-xs text-slate-400 mt-1">Call Keycloak OIDC endpoint with user alice credentials.</p>
            <button className="mt-3 w-full py-1.5 px-3 rounded bg-blue-600/30 hover:bg-blue-600/40 text-blue-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
              <Key className="w-3 h-3" /> {token ? 'Regenerate JWT' : 'Acquire Token'}
            </button>
          </div>

          <div 
            onClick={() => { setActiveStep(3); runAuthenticatedTest(); }}
            className={`cursor-pointer p-4 rounded-xl border transition-all ${
              activeStep === 3 
                ? 'bg-emerald-950/30 border-emerald-500/60 shadow-lg shadow-emerald-900/20' 
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-mono text-slate-400">STEP 3</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">200 OK</span>
            </div>
            <h4 className="font-semibold text-white text-sm">Pass Bearer Token</h4>
            <p className="text-xs text-slate-400 mt-1">Send request with valid JWT header to test upstream proxying.</p>
            <button className="mt-3 w-full py-1.5 px-3 rounded bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
              <Play className="w-3 h-3" /> Execute Authenticated
            </button>
          </div>

          <div 
            onClick={() => { setActiveStep(4); triggerBurstRateLimit(); }}
            className={`cursor-pointer p-4 rounded-xl border transition-all ${
              activeStep === 4 
                ? 'bg-amber-950/30 border-amber-500/60 shadow-lg shadow-amber-900/20' 
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-mono text-slate-400">STEP 4</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">429 Throttling</span>
            </div>
            <h4 className="font-semibold text-white text-sm">DDoS Burst Simulation</h4>
            <p className="text-xs text-slate-400 mt-1">Burst 12 calls to trigger APISIX limit-count 429 response.</p>
            <button 
              disabled={isRunningBurst}
              className="mt-3 w-full py-1.5 px-3 rounded bg-amber-600/30 hover:bg-amber-600/40 text-amber-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Zap className="w-3 h-3" /> {isRunningBurst ? 'Bursting...' : 'Fire Burst'}
            </button>
          </div>
        </div>
      </div>

      {/* Simulator Response & Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Terminal Output / Response Inspector */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white">HTTP Response Inspector</span>
            </div>
            {lastResponse && (
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className={`px-2 py-0.5 rounded font-bold ${
                  lastResponse.statusCode === 200 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  lastResponse.statusCode === 401 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                  'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  HTTP {lastResponse.statusCode} {lastResponse.statusText}
                </span>
                <span className="text-slate-500">{lastResponse.latencyMs}ms</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto bg-slate-950 rounded-lg p-4 font-mono text-xs text-slate-300 mt-3 border border-slate-900">
            {lastResponse ? (
              <div className="space-y-4">
                {/* Headers */}
                <div>
                  <div className="text-slate-500 text-[11px] uppercase tracking-wider mb-1 font-semibold">Response Headers:</div>
                  <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800/80 space-y-1">
                    {Object.entries(lastResponse.headers).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-cyan-400 font-semibold">{k}:</span>
                        <span className="text-slate-300">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Body */}
                <div>
                  <div className="text-slate-500 text-[11px] uppercase tracking-wider mb-1 font-semibold">Response Payload:</div>
                  <pre className="bg-slate-900/80 p-3 rounded border border-slate-800/80 text-emerald-300 overflow-x-auto">
                    {JSON.stringify(lastResponse.body, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                <Terminal className="w-8 h-8 mb-2 opacity-50" />
                <p>Click any test step above to execute an APISIX gateway call.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: JWT Inspector & Activity Console */}
        <div className="lg:col-span-5 space-y-4 flex flex-col h-[520px]">
          {/* JWT Decoder Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white">Keycloak JWT Claims Inspector</span>
              </div>
              <button
                onClick={() => setShowJwtDecoder(!showJwtDecoder)}
                disabled={!token}
                className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
              >
                {showJwtDecoder ? 'Show Raw' : 'Decode Payload'}
              </button>
            </div>

            <div className="flex-1 overflow-auto mt-3 bg-slate-950 p-3 rounded-lg border border-slate-900 font-mono text-[11px]">
              {token ? (
                showJwtDecoder ? (
                  <div className="space-y-3">
                    <div>
                      <span className="text-slate-500 block font-semibold mb-1">Decoded Payload Claims:</span>
                      <pre className="text-teal-300 bg-slate-900/90 p-2.5 rounded border border-slate-800">
{JSON.stringify({
  iss: "http://auth.zerotrust.local/realms/zero-trust",
  aud: "apisix-client",
  sub: "7c98b671-55b2-48df-9a84-8a4e32057d62",
  preferred_username: "alice",
  email: "alice@zerotrust.example.com",
  realm_access: {
    roles: ["api-consumer", "api-admin"]
  },
  scope: "openid profile email roles",
  exp: Math.floor(Date.now() / 1000) + 300
}, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-slate-500 block font-semibold mb-1">Raw Base64 JWT:</span>
                    <p className="text-slate-400 break-all leading-relaxed bg-slate-900/90 p-2.5 rounded border border-slate-800">
                      <span className="text-rose-400">{token.split('.')[0]}</span>.
                      <span className="text-teal-400">{token.split('.')[1]}</span>.
                      <span className="text-indigo-400">{token.split('.')[2]}</span>
                    </p>
                  </div>
                )
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                  <Lock className="w-6 h-6 mb-2 opacity-50" />
                  <p>Execute Step 2 to issue and inspect an active OIDC token.</p>
                </div>
              )}
            </div>
          </div>

          {/* Real-time Gateway Logs */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 h-[200px] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
              <span className="font-bold text-slate-300 font-mono">Gateway Execution Log</span>
              <span className="text-emerald-400 text-[10px] font-mono">● LIVE</span>
            </div>
            <div className="flex-1 overflow-auto font-mono text-[11px] text-slate-400 space-y-1 mt-2">
              {consoleLogs.length === 0 ? (
                <p className="text-slate-600">No events yet.</p>
              ) : (
                consoleLogs.map((log, idx) => (
                  <div key={idx} className={log.includes('401') ? 'text-rose-400' : log.includes('200') ? 'text-emerald-400' : log.includes('429') ? 'text-amber-400' : 'text-slate-400'}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
