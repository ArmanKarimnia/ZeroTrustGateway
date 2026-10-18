#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="zero-trust-gateway"

echo "=========================================================="
echo " Creating KinD Cluster: ${CLUSTER_NAME} with Ingress Ports"
echo "=========================================================="

if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
  echo "Cluster '${CLUSTER_NAME}' already exists. Skipping creation."
else
  kind create cluster --config kind-config.yaml --name "${CLUSTER_NAME}"
fi

kubectl cluster-info --context "kind-${CLUSTER_NAME}"
echo "KinD cluster '${CLUSTER_NAME}' is ready!"
