.PHONY: help kind-up kind-down lint deploy test clean

help:
	@echo "Zero-Trust API Gateway (Apache APISIX + Keycloak)"
	@echo ""
	@echo "Targets:"
	@echo "  make kind-up     Create local KinD cluster with ingress port mappings"
	@echo "  make lint        Run Helm lint on APISIX and Keycloak values"
	@echo "  make deploy      Deploy all charts, CRDs, and configurations to KinD"
	@echo "  make test        Execute automated curl OIDC and rate-limiting tests"
	@echo "  make kind-down   Delete the local KinD cluster"
	@echo "  make clean       Clean up local artifacts"

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
	./scripts/teardown.sh

clean: kind-down
