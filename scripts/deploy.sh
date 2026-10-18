#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo " Zero-Trust API Gateway: Production Deployment Script"
echo " Apache APISIX + Keycloak (OIDC) on Kubernetes"
echo "=========================================================="

# 1. Namespaces & Base Secrets
echo "--> [1/6] Applying Namespaces and Provisioning Secrets..."
kubectl apply -f k8s/base/namespaces.yaml

kubectl create secret generic keycloak-admin-secret \
  --namespace=keycloak \
  --from-literal=admin-password='SuperAdminKeycloakPassword2026!' \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic keycloak-db-secret \
  --namespace=keycloak \
  --from-literal=postgres-password='KeycloakPostgresPassword2026!' \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic apisix-admin-secret \
  --namespace=ingress-apisix \
  --from-literal=admin-key='edd1c9f034335f136f87ad84b625c8f1' \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic apisix-oidc-secret \
  --namespace=ingress-apisix \
  --from-literal=client-secret='apisix-oidc-client-super-secret-2026' \
  --dry-run=client -o yaml | kubectl apply -f -

# 2. Keycloak Realm ConfigMap
echo "--> [2/6] Loading Keycloak Realm Auto-Import ConfigMap..."
kubectl create configmap keycloak-realm-import \
  --namespace=keycloak \
  --from-file=realm-export.json=keycloak/realm-export.json \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. Helm Repositories
echo "--> [3/6] Updating Helm Repositories..."
helm repo add apisix https://charts.apiseven.com --force-update
helm repo add bitnami https://charts.bitnami.com/bitnami --force-update
helm repo update

# 4. Deploy Keycloak with PostgreSQL
echo "--> [4/6] Deploying Keycloak (with PostgreSQL backend)..."
helm upgrade --install keycloak bitnami/keycloak \
  --namespace keycloak \
  --values helm/keycloak/values.yaml \
  --wait --timeout 10m

# 5. Deploy Apache APISIX and Ingress Controller
echo "--> [5/6] Deploying Apache APISIX Ingress Controller..."
helm upgrade --install apisix apisix/apisix \
  --namespace ingress-apisix \
  --values helm/apisix/values.yaml \
  --wait --timeout 10m

# 6. Deploy Sample Upstream & ApisixRoutes
echo "--> [6/6] Deploying Upstream Httpbin & Zero-Trust ApisixRoutes..."
kubectl apply -f k8s/base/httpbin-upstream.yaml
kubectl wait --namespace demo-apps --for=condition=ready pod -l app=httpbin --timeout=120s

kubectl apply -f k8s/base/apisix-plugin-config.yaml
kubectl apply -f k8s/base/apisix-route-httpbin.yaml

echo "=========================================================="
echo " Deployment Successfully Completed!"
echo " Gateway URL: http://localhost:80 (api.zerotrust.local)"
echo " Keycloak URL: http://localhost:80 (auth.zerotrust.local)"
echo " Run ./scripts/test-oidc-flow.sh to verify zero-trust enforcement."
echo "=========================================================="
