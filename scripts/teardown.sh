#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="zero-trust-gateway"

echo "Tearing down KinD cluster '${CLUSTER_NAME}'..."
kind delete cluster --name "${CLUSTER_NAME}" || true
echo "Cleanup completed."
