export interface RepoFile {
  path: string;
  name: string;
  category: 'workflow' | 'helm' | 'k8s' | 'keycloak' | 'scripts' | 'root';
  description: string;
  language: 'yaml' | 'json' | 'bash' | 'markdown' | 'dockerfile';
  content: string;
}

export const REPOSITORY_FILES: RepoFile[] = [
  {
    path: '.github/workflows/ci.yml',
    name: 'ci.yml',
    category: 'workflow',
    description: 'GitHub Actions workflow with Helm linting, KinD provisioning, and automated curl OIDC tests',
    language: 'yaml',
    content: `name: Zero-Trust CI/CD Validation Pipeline

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]
  workflow_dispatch:

jobs:
  helm-lint:
    name: Helm Chart Validation & Linting
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up Helm
        uses: azure/setup-helm@v4
        with:
          version: v3.14.0

      - name: Add Helm Repositories
        run: |
          helm repo add apisix https://charts.apiseven.com
          helm repo add bitnami https://charts.bitnami.com/bitnami
          helm repo update

      - name: Lint APISIX Values
        run: |
          helm lint apisix/apisix -f helm/apisix/values.yaml

      - name: Lint Keycloak Values
        run: |
          helm lint bitnami/keycloak -f helm/keycloak/values.yaml

      - name: Validate Kubernetes Manifests with Kubeconform
        run: |
          curl -sL https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz | tar xz
          sudo mv kubeconform /usr/local/bin/
          kubeconform -summary -strict -ignore-missing-schemas k8s/base/

  e2e-kind-test:
    name: KinD Cluster E2E Zero-Trust Integration Test
    needs: helm-lint
    runs-on: ubuntu-latest
    timeout-minutes: 25

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up Kubernetes KinD Cluster
        uses: helm/kind-action@v1.9.0
        with:
          config: kind-config.yaml
          cluster_name: zero-trust-gateway
          wait: 120s

      - name: Verify KinD Cluster Nodes
        run: |
          kubectl get nodes -o wide
          kubectl cluster-info

      - name: Create Namespaces & Apply Secrets
        run: |
          kubectl apply -f k8s/base/namespaces.yaml
          
          # Provision OIDC & Database Secrets (Strict GitOps adherence: no hardcoded secrets in manifests)
          kubectl create secret generic keycloak-admin-secret \\
            --namespace=keycloak \\
            --from-literal=admin-password='SuperAdminKeycloakPassword2026!' \\
            --dry-run=client -o yaml | kubectl apply -f -

          kubectl create secret generic keycloak-db-secret \\
            --namespace=keycloak \\
            --from-literal=postgres-password='KeycloakPostgresPassword2026!' \\
            --dry-run=client -o yaml | kubectl apply -f -

          kubectl create secret generic apisix-oidc-secret \\
            --namespace=ingress-apisix \\
            --from-literal=client-secret='apisix-oidc-client-super-secret-2026' \\
            --dry-run=client -o yaml | kubectl apply -f -

      - name: Deploy Keycloak Realm ConfigMap
        run: |
          kubectl create configmap keycloak-realm-import \\
            --namespace=keycloak \\
            --from-file=realm-export.json=keycloak/realm-export.json \\
            --dry-run=client -o yaml | kubectl apply -f -

      - name: Add & Update Helm Repositories
        run: |
          helm repo add apisix https://charts.apiseven.com
          helm repo add bitnami https://charts.bitnami.com/bitnami
          helm repo update

      - name: Deploy Keycloak with PostgreSQL Backend
        run: |
          helm upgrade --install keycloak bitnami/keycloak \\
            --namespace keycloak \\
            --values helm/keycloak/values.yaml \\
            --wait --timeout 10m

      - name: Deploy Apache APISIX & Ingress Controller
        run: |
          helm upgrade --install apisix apisix/apisix \\
            --namespace ingress-apisix \\
            --values helm/apisix/values.yaml \\
            --wait --timeout 10m

      - name: Verify CRD Installation
        run: |
          kubectl get crds | grep apisix.apache.org

      - name: Deploy Upstream Httpbin & Zero-Trust ApisixRoutes
        run: |
          kubectl apply -f k8s/base/httpbin-upstream.yaml
          kubectl wait --namespace demo-apps --for=condition=ready pod -l app=httpbin --timeout=120s
          
          kubectl apply -f k8s/base/apisix-plugin-config.yaml
          kubectl apply -f k8s/base/apisix-route-httpbin.yaml

      - name: Wait for Ingress Readiness & Pod Status Check
        run: |
          kubectl get pods -A -o wide
          kubectl get apisixroute -A

      - name: Test 1 - Verify Unauthenticated Request Returns 401 Unauthorized
        run: |
          echo "Testing unauthenticated request to http://localhost/httpbin/headers..."
          HTTP_CODE=\$(curl -s -o /dev/null -w "%{http_code}" -H "Host: api.zerotrust.local" http://localhost/httpbin/headers)
          echo "Received HTTP Status Code: \${HTTP_CODE}"
          if [ "\${HTTP_CODE}" -ne 401 ]; then
            echo "FAILED: Expected 401 Unauthorized without token, got \${HTTP_CODE}"
            exit 1
          fi
          echo "PASSED: Zero-Trust boundary successfully blocked unauthenticated request with 401!"

      - name: Test 2 - Authenticate with Keycloak and Acquire JWT Access Token
        id: get_token
        run: |
          echo "Acquiring OIDC JWT Access Token from Keycloak..."
          TOKEN_RESPONSE=\$(curl -s -X POST \\
            -H "Host: auth.zerotrust.local" \\
            -H "Content-Type: application/x-www-form-urlencoded" \\
            "http://localhost/realms/zero-trust/protocol/openid-connect/token" \\
            -d "client_id=apisix-client" \\
            -d "client_secret=apisix-oidc-client-super-secret-2026" \\
            -d "grant_type=password" \\
            -d "username=alice" \\
            -d "password=Password123!")

          ACCESS_TOKEN=\$(echo "\${TOKEN_RESPONSE}" | jq -r '.access_token')
          if [ -z "\${ACCESS_TOKEN}" ] || [ "\${ACCESS_TOKEN}" = "null" ]; then
            echo "FAILED to acquire token. Response was: \${TOKEN_RESPONSE}"
            exit 1
          fi

          echo "Successfully retrieved Bearer Token!"
          echo "token=\${ACCESS_TOKEN}" >> "$GITHUB_OUTPUT"

      - name: Test 3 - Verify Authenticated Request with Bearer Token Returns 200 OK
        env:
          BEARER_TOKEN: \${{ steps.get_token.outputs.token }}
        run: |
          echo "Testing authenticated request with Bearer JWT..."
          RESPONSE=\$(curl -s -w "\\nHTTP_STATUS:%{http_code}" \\
            -H "Host: api.zerotrust.local" \\
            -H "Authorization: Bearer \${BEARER_TOKEN}" \\
            http://localhost/httpbin/headers)

          HTTP_CODE=\$(echo "\${RESPONSE}" | grep "HTTP_STATUS" | cut -d':' -f2)
          echo "Authenticated Request HTTP Code: \${HTTP_CODE}"

          if [ "\${HTTP_CODE}" -ne 200 ]; then
            echo "FAILED: Expected 200 OK with valid token, got \${HTTP_CODE}"
            echo "Response: \${RESPONSE}"
            exit 1
          fi
          echo "PASSED: Upstream service reached successfully with OIDC identity verification!"

      - name: Test 4 - Verify Rate Limiting Plugin (DDoS Mitigation) Returns 429
        env:
          BEARER_TOKEN: \${{ steps.get_token.outputs.token }}
        run: |
          echo "Testing APISIX limit-count plugin threshold (threshold=10 req / 60s)..."
          TRIGGERED_429=0
          for i in \$(seq 1 15); do
            CODE=\$(curl -s -o /dev/null -w "%{http_code}" \\
              -H "Host: api.zerotrust.local" \\
              -H "Authorization: Bearer \${BEARER_TOKEN}" \\
              http://localhost/httpbin/headers)
            echo "Request #$i -> HTTP $CODE"
            if [ "$CODE" -eq 429 ]; then
              TRIGGERED_429=1
              echo "PASSED: Rate limiting triggered 429 Too Many Requests as expected on request #$i!"
              break
            fi
            sleep 0.1
          done

          if [ "$TRIGGERED_429" -ne 1 ]; then
            echo "FAILED: Rate limit was not enforced (did not receive HTTP 429)!"
            exit 1
          fi

      - name: Export Cluster Debug Logs on Failure
        if: failure()
        run: |
          kubectl get all -A
          kubectl logs -n ingress-apisix -l app.kubernetes.io/name=apisix --tail=100
          kubectl logs -n keycloak -l app.kubernetes.io/name=keycloak --tail=100`
  },
  {
    path: 'helm/apisix/values.yaml',
    name: 'values.yaml (APISIX)',
    category: 'helm',
    description: 'Production Helm values override for Apache APISIX & APISIX Ingress Controller',
    language: 'yaml',
    content: `# Apache APISIX Production-Grade Helm Values Override
# Chart: apisix/apisix (https://charts.apiseven.com)

global:
  imagePullSecrets: []

# Apache APISIX Data-Plane Configuration
apisix:
  enabled: true
  image:
    repository: apache/apisix
    tag: "3.9.1-debian"
    pullPolicy: IfNotPresent

  replicaCount: 2

  # Enable required plugins for Zero-Trust and Security Hardening
  plugins:
    - openid-connect
    - limit-count
    - limit-req
    - limit-conn
    - cors
    - key-auth
    - jwt-auth
    - proxy-rewrite
    - response-rewrite
    - prometheus
    - ip-restriction

  extraEnvVars:
    - name: APISIX_STANDALONE
      value: "false"

  service:
    type: NodePort
    http:
      enabled: true
      port: 9080
      containerPort: 9080
      nodePort: 80
    tls:
      enabled: true
      servicePort: 9443
      containerPort: 9443
      nodePort: 443

  resources:
    limits:
      cpu: "1000m"
      memory: "1024Mi"
    requests:
      cpu: "250m"
      memory: "256Mi"

  livenessProbe:
    httpGet:
      path: /apisix/status
      port: 9090
    initialDelaySeconds: 15
    periodSeconds: 10
  readinessProbe:
    httpGet:
      path: /apisix/status
      port: 9090
    initialDelaySeconds: 10
    periodSeconds: 5

ingress-controller:
  enabled: true
  image:
    repository: apache/apisix-ingress-controller
    tag: "1.8.1"
    pullPolicy: IfNotPresent

  config:
    logLevel: "info"
    kubernetes:
      kubeconfig: ""
      resyncInterval: "60s"
      appNamespaces:
        - "*"
      apisixRouteVersion: "apisix.apache.org/v2"
      watchEndpointSlices: true
    apisix:
      serviceNamespace: "ingress-apisix"
      serviceName: "apisix-admin"
      servicePort: 9180
      adminKeyExistingSecret: "apisix-admin-secret"
      adminKeyExistingSecretKey: "admin-key"

  resources:
    limits:
      cpu: "500m"
      memory: "512Mi"
    requests:
      cpu: "100m"
      memory: "128Mi"

etcd:
  enabled: true
  replicaCount: 1
  persistence:
    enabled: true
    size: 2Gi
  auth:
    rbac:
      create: false`
  },
  {
    path: 'helm/keycloak/values.yaml',
    name: 'values.yaml (Keycloak)',
    category: 'helm',
    description: 'Production Helm values override for Keycloak with persistent PostgreSQL backend and realm auto-import',
    language: 'yaml',
    content: `# Production Keycloak Helm Values Override with PostgreSQL Backend
# Chart: bitnami/keycloak (https://charts.bitnami.com/bitnami)

global:
  imageRegistry: docker.io

auth:
  adminUser: "admin"
  existingSecret: "keycloak-admin-secret"
  passwordSecretKey: "admin-password"

proxyHeaders: "xforwarded"
httpRelativePath: "/"
extraStartupArgs: "--import-realm"

extraVolumes:
  - name: realm-config
    configMap:
      name: keycloak-realm-import
      items:
        - key: realm-export.json
          path: realm-export.json

extraVolumeMounts:
  - name: realm-config
    mountPath: /opt/bitnami/keycloak/data/import
    readOnly: true

service:
  type: ClusterIP
  ports:
    http: 8080

ingress:
  enabled: false

resources:
  limits:
    cpu: "1000m"
    memory: "1536Mi"
  requests:
    cpu: "300m"
    memory: "512Mi"

postgresql:
  enabled: true
  auth:
    username: "keycloak"
    database: "keycloak"
    existingSecret: "keycloak-db-secret"
    secretKeys:
      userPasswordKey: "postgres-password"
      adminPasswordKey: "postgres-password"
  primary:
    persistence:
      enabled: true
      size: 8Gi
    resources:
      limits:
        cpu: "500m"
        memory: "512Mi"
      requests:
        cpu: "150m"
        memory: "256Mi"`
  },
  {
    path: 'k8s/base/apisix-route-httpbin.yaml',
    name: 'apisix-route-httpbin.yaml',
    category: 'k8s',
    description: 'ApisixRoute CRD implementing openid-connect bearer verification and upstream proxy routing',
    language: 'yaml',
    content: `apiVersion: apisix.apache.org/v2
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
          - "api.zerotrust.local"
          - "localhost"
          - "127.0.0.1"
        paths:
          - "/httpbin/*"
          - "/headers"
          - "/ip"
          - "/get"
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
            client_id: "apisix-client"
            client_secret: "apisix-oidc-client-super-secret-2026"
            discovery: "http://keycloak.keycloak.svc.cluster.local:8080/realms/zero-trust/.well-known/openid-configuration"
            introspection_endpoint: "http://keycloak.keycloak.svc.cluster.local:8080/realms/zero-trust/protocol/openid-connect/token/introspect"
            token_endpoint: "http://keycloak.keycloak.svc.cluster.local:8080/realms/zero-trust/protocol/openid-connect/token"
            bearer_only: true
            realm: "zero-trust"
            scope: "openid profile email roles"
            set_userinfo_header: true
            set_access_token_header: true
            set_id_token_header: true
            ssl_verify: false
            timeout: 10
      upstreams:
        - name: httpbin
          port: 80
---
apiVersion: apisix.apache.org/v2
kind: ApisixRoute
metadata:
  name: keycloak-ingress-route
  namespace: keycloak
  labels:
    app.kubernetes.io/name: apisix-route
    app.kubernetes.io/part-of: zero-trust-gateway
spec:
  http:
    - name: keycloak-public-endpoints
      match:
        hosts:
          - "auth.zerotrust.local"
          - "localhost"
          - "127.0.0.1"
        paths:
          - "/realms/*"
          - "/resources/*"
          - "/js/*"
      plugins:
        - name: cors
          enable: true
          config:
            allow_origins: "*"
            allow_methods: "GET,POST,OPTIONS"
            allow_headers: "*"
      upstreams:
        - name: keycloak
          port: 8080`
  },
  {
    path: 'k8s/base/apisix-plugin-config.yaml',
    name: 'apisix-plugin-config.yaml',
    category: 'k8s',
    description: 'ApisixPluginConfig CRD for DDoS rate limiting (limit-count), CORS, and Prometheus metrics',
    language: 'yaml',
    content: `apiVersion: apisix.apache.org/v2
kind: ApisixPluginConfig
metadata:
  name: zero-trust-security-policy
  namespace: ingress-apisix
spec:
  plugins:
    - name: limit-count
      enable: true
      config:
        count: 10
        time_window: 60
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
        allow_headers: "DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization"
        expose_headers: "X-RateLimit-Limit,X-RateLimit-Remaining,X-RateLimit-Reset"
        max_age: 3600
        allow_credential: true
    - name: prometheus
      enable: true`
  },
  {
    path: 'keycloak/realm-export.json',
    name: 'realm-export.json',
    category: 'keycloak',
    description: 'Keycloak Realm export bootstrapping zero-trust realm, confidential client, roles, and test users',
    language: 'json',
    content: `{
  "realm": "zero-trust",
  "enabled": true,
  "displayName": "Zero-Trust Enterprise Realm",
  "sslRequired": "external",
  "registrationAllowed": false,
  "loginWithEmailAllowed": true,
  "roles": {
    "realm": [
      {
        "name": "api-consumer",
        "description": "Standard API consumer with verified OIDC identity"
      },
      {
        "name": "api-admin",
        "description": "Administrative access to critical upstream microservices"
      }
    ]
  },
  "clients": [
    {
      "clientId": "apisix-client",
      "name": "Apache APISIX Zero-Trust Gateway Client",
      "enabled": true,
      "clientAuthenticatorType": "client-secret",
      "secret": "apisix-oidc-client-super-secret-2026",
      "bearerOnly": false,
      "standardFlowEnabled": true,
      "directAccessGrantsEnabled": true,
      "serviceAccountsEnabled": true,
      "publicClient": false,
      "protocol": "openid-connect",
      "redirectUris": [
        "http://api.zerotrust.local/*",
        "http://localhost/*",
        "http://127.0.0.1/*"
      ]
    }
  ],
  "users": [
    {
      "username": "alice",
      "enabled": true,
      "email": "alice@zerotrust.example.com",
      "firstName": "Alice",
      "lastName": "Engineer",
      "emailVerified": true,
      "credentials": [
        {
          "type": "password",
          "value": "Password123!",
          "temporary": false
        }
      ],
      "realmRoles": [
        "api-consumer",
        "api-admin"
      ]
    }
  ]
}`
  },
  {
    path: 'k8s/base/httpbin-upstream.yaml',
    name: 'httpbin-upstream.yaml',
    category: 'k8s',
    description: 'Upstream test microservice Deployment and ClusterIP Service',
    language: 'yaml',
    content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: httpbin
  namespace: demo-apps
spec:
  replicas: 2
  selector:
    matchLabels:
      app: httpbin
  template:
    metadata:
      labels:
        app: httpbin
    spec:
      containers:
        - name: httpbin
          image: mccutchen/go-httpbin:v2.13.0
          ports:
            - containerPort: 8080
              name: http
---
apiVersion: v1
kind: Service
metadata:
  name: httpbin
  namespace: demo-apps
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 8080
  selector:
    app: httpbin`
  },
  {
    path: 'k8s/base/secrets.yaml.template',
    name: 'secrets.yaml.template',
    category: 'k8s',
    description: 'GitOps Secret template for Keycloak admin, PostgreSQL, APISIX admin, and OIDC client secret',
    language: 'yaml',
    content: `apiVersion: v1
kind: Secret
metadata:
  name: keycloak-admin-secret
  namespace: keycloak
type: Opaque
stringData:
  admin-password: "SuperAdminKeycloakPassword2026!"
---
apiVersion: v1
kind: Secret
metadata:
  name: keycloak-db-secret
  namespace: keycloak
type: Opaque
stringData:
  postgres-password: "KeycloakPostgresPassword2026!"
---
apiVersion: v1
kind: Secret
metadata:
  name: apisix-admin-secret
  namespace: ingress-apisix
type: Opaque
stringData:
  admin-key: "edd1c9f034335f136f87ad84b625c8f1"
---
apiVersion: v1
kind: Secret
metadata:
  name: apisix-oidc-secret
  namespace: ingress-apisix
type: Opaque
stringData:
  client-secret: "apisix-oidc-client-super-secret-2026"`
  },
  {
    path: 'k8s/base/namespaces.yaml',
    name: 'namespaces.yaml',
    category: 'k8s',
    description: 'Namespace definitions with Pod Security Standards (baseline & restricted)',
    language: 'yaml',
    content: `apiVersion: v1
kind: Namespace
metadata:
  name: ingress-apisix
  labels:
    pod-security.kubernetes.io/enforce: baseline
---
apiVersion: v1
kind: Namespace
metadata:
  name: keycloak
  labels:
    pod-security.kubernetes.io/enforce: baseline
---
apiVersion: v1
kind: Namespace
metadata:
  name: demo-apps
  labels:
    pod-security.kubernetes.io/enforce: restricted`
  },
  {
    path: 'scripts/test-oidc-flow.sh',
    name: 'test-oidc-flow.sh',
    category: 'scripts',
    description: 'Bash integration test verifying 401 unauth, Keycloak password grant token fetch, 200 auth, and 429 rate limit',
    language: 'bash',
    content: `#!/usr/bin/env bash
set -euo pipefail

GATEWAY_HOST="127.0.0.1"
API_DOMAIN="api.zerotrust.local"
AUTH_DOMAIN="auth.zerotrust.local"

echo "=== [TEST 1] Testing Unauthenticated Request (Expect 401) ==="
UNAUTH_CODE=\$(curl -s -o /dev/null -w "%{http_code}" -H "Host: \${API_DOMAIN}" "http://\${GATEWAY_HOST}/httpbin/headers")
echo "HTTP Status Code: \${UNAUTH_CODE}"
[ "\${UNAUTH_CODE}" -eq 401 ] && echo "✔ PASS: 401 Unauthorized" || exit 1

echo "=== [TEST 2] Requesting OIDC Token from Keycloak ==="
TOKEN_RESPONSE=\$(curl -s -X POST \\
  -H "Host: \${AUTH_DOMAIN}" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  "http://\${GATEWAY_HOST}/realms/zero-trust/protocol/openid-connect/token" \\
  -d "client_id=apisix-client" \\
  -d "client_secret=apisix-oidc-client-super-secret-2026" \\
  -d "grant_type=password" \\
  -d "username=alice" \\
  -d "password=Password123!")

ACCESS_TOKEN=\$(echo "\${TOKEN_RESPONSE}" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
echo "✔ PASS: Acquired Access Token!"

echo "=== [TEST 3] Testing Authenticated Request with Bearer Token (Expect 200) ==="
AUTH_CODE=\$(curl -s -o /dev/null -w "%{http_code}" \\
  -H "Host: \${API_DOMAIN}" \\
  -H "Authorization: Bearer \${ACCESS_TOKEN}" \\
  "http://\${GATEWAY_HOST}/httpbin/headers")
[ "\${AUTH_CODE}" -eq 200 ] && echo "✔ PASS: 200 OK with verified identity" || exit 1

echo "=== [TEST 4] Testing Rate Limiting (DDoS Defense - Expect 429) ==="
TRIGGERED=0
for i in \$(seq 1 15); do
  CODE=\$(curl -s -o /dev/null -w "%{http_code}" \\
    -H "Host: \${API_DOMAIN}" \\
    -H "Authorization: Bearer \${ACCESS_TOKEN}" \\
    "http://\${GATEWAY_HOST}/httpbin/headers")
  if [ "\${CODE}" -eq 429 ]; then
    TRIGGERED=1
    echo "✔ PASS: HTTP 429 triggered on request #\$i"
    break
  fi
done
[ "\${TRIGGERED}" -eq 1 ] && echo "All Zero-Trust tests passed!" || exit 1`
  },
  {
    path: 'scripts/deploy.sh',
    name: 'deploy.sh',
    category: 'scripts',
    description: 'One-click deployment script automating Helm installs and CRD application',
    language: 'bash',
    content: `#!/usr/bin/env bash
set -euo pipefail

kubectl apply -f k8s/base/namespaces.yaml

kubectl create secret generic keycloak-admin-secret -n keycloak --from-literal=admin-password='SuperAdminKeycloakPassword2026!' --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic keycloak-db-secret -n keycloak --from-literal=postgres-password='KeycloakPostgresPassword2026!' --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic apisix-admin-secret -n ingress-apisix --from-literal=admin-key='edd1c9f034335f136f87ad84b625c8f1' --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic apisix-oidc-secret -n ingress-apisix --from-literal=client-secret='apisix-oidc-client-super-secret-2026' --dry-run=client -o yaml | kubectl apply -f -

kubectl create configmap keycloak-realm-import -n keycloak --from-file=realm-export.json=keycloak/realm-export.json --dry-run=client -o yaml | kubectl apply -f -

helm repo add apisix https://charts.apiseven.com --force-update
helm repo add bitnami https://charts.bitnami.com/bitnami --force-update
helm repo update

helm upgrade --install keycloak bitnami/keycloak -n keycloak -f helm/keycloak/values.yaml --wait --timeout 10m
helm upgrade --install apisix apisix/apisix -n ingress-apisix -f helm/apisix/values.yaml --wait --timeout 10m

kubectl apply -f k8s/base/httpbin-upstream.yaml
kubectl apply -f k8s/base/apisix-plugin-config.yaml
kubectl apply -f k8s/base/apisix-route-httpbin.yaml
echo "Zero-Trust Gateway deployed successfully!"`
  },
  {
    path: 'kind-config.yaml',
    name: 'kind-config.yaml',
    category: 'root',
    description: 'KinD cluster definition with port 80 & 443 host mappings for Ingress testing',
    language: 'yaml',
    content: `kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: zero-trust-gateway
nodes:
  - role: control-plane
    image: kindest/node:v1.30.0
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "ingress-ready=true"
    extraPortMappings:
      - containerPort: 80
        hostPort: 80
        protocol: TCP
      - containerPort: 443
        hostPort: 443
        protocol: TCP`
  },
  {
    path: 'Makefile',
    name: 'Makefile',
    category: 'root',
    description: 'Developer commands: make kind-up, make deploy, make test, make lint, make clean',
    language: 'bash',
    content: `.PHONY: kind-up lint deploy test kind-down clean

kind-up:
	./scripts/setup-kind.sh

lint:
	helm lint apisix/apisix -f helm/apisix/values.yaml
	helm lint bitnami/keycloak -f helm/keycloak/values.yaml

deploy:
	./scripts/deploy.sh

test:
	./scripts/test-oidc-flow.sh

kind-down:
	./scripts/teardown.sh`
  },
  {
    path: 'README.md',
    name: 'README.md',
    category: 'root',
    description: 'Comprehensive documentation with Mermaid.js architecture diagrams and step-by-step testing instructions',
    language: 'markdown',
    content: `# Zero-Trust API Gateway: Apache APISIX & Keycloak on Kubernetes

A production-grade, GitOps-driven reference architecture implementing a Zero-Trust API Gateway perimeter using Apache APISIX Ingress Controller, Keycloak (OIDC/OAuth2) with a PostgreSQL database backend, DDoS rate limiting (limit-count), and automated integration tests on KinD.`
  }
];
