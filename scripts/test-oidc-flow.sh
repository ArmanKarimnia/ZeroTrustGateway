#!/usr/bin/env bash
set -euo pipefail

GATEWAY_HOST="127.0.0.1"
API_DOMAIN="api.zerotrust.local"
AUTH_DOMAIN="auth.zerotrust.local"

echo "=========================================================="
echo " Running Zero-Trust Verification Test Suite"
echo "=========================================================="

echo ""
echo "[TEST 1] Testing Unauthenticated Request -> Expecting 401 Unauthorized"
UNAUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: ${API_DOMAIN}" "http://${GATEWAY_HOST}/httpbin/headers")
echo "HTTP Status Code: ${UNAUTH_CODE}"
if [ "${UNAUTH_CODE}" -eq 401 ]; then
  echo "✔ PASS: Unauthenticated access blocked at APISIX perimeter with 401 Unauthorized."
else
  echo "✖ FAIL: Expected HTTP 401, but received ${UNAUTH_CODE}."
  exit 1
fi

echo ""
echo "[TEST 2] Requesting OIDC Bearer Token from Keycloak (OAuth2 Password Grant)"
TOKEN_RESPONSE=$(curl -s -X POST \
  -H "Host: ${AUTH_DOMAIN}" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  "http://${GATEWAY_HOST}/realms/zero-trust/protocol/openid-connect/token" \
  -d "client_id=apisix-client" \
  -d "client_secret=apisix-oidc-client-super-secret-2026" \
  -d "grant_type=password" \
  -d "username=alice" \
  -d "password=Password123!")

ACCESS_TOKEN=$(echo "${TOKEN_RESPONSE}" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4 || true)

if [ -z "${ACCESS_TOKEN}" ]; then
  echo "✖ FAIL: Could not retrieve access token. Server response:"
  echo "${TOKEN_RESPONSE}"
  exit 1
fi

echo "✔ PASS: Successfully acquired OIDC Bearer Token (Length: ${#ACCESS_TOKEN} chars)"

echo ""
echo "[TEST 3] Testing Authenticated Request with Bearer Token -> Expecting 200 OK"
AUTH_RESPONSE=$(curl -s -w "\nSTATUS:%{http_code}" \
  -H "Host: ${API_DOMAIN}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "http://${GATEWAY_HOST}/httpbin/headers")

STATUS=$(echo "${AUTH_RESPONSE}" | grep "STATUS:" | cut -d':' -f2)
BODY=$(echo "${AUTH_RESPONSE}" | grep -v "STATUS:")

if [ "${STATUS}" -eq 200 ]; then
  echo "✔ PASS: Authenticated request succeeded with HTTP 200 OK."
  echo "Inspecting Injected Upstream Headers:"
  echo "${BODY}" | grep -i -E "x-userinfo|x-access-token|x-id-token|authorization" || echo "${BODY}"
else
  echo "✖ FAIL: Expected HTTP 200, but received ${STATUS}."
  echo "Response Body: ${BODY}"
  exit 1
fi

echo ""
echo "[TEST 4] Testing APISIX limit-count Plugin (DDoS Mitigation) -> Expecting 429"
echo "Sending 15 rapid requests (Limit is 10 req/min)..."
TRIGGERED=0
for i in $(seq 1 15); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Host: ${API_DOMAIN}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    "http://${GATEWAY_HOST}/httpbin/headers")
  echo " - Request #${i}: HTTP ${CODE}"
  if [ "${CODE}" -eq 429 ]; then
    TRIGGERED=1
    echo "✔ PASS: Rate limit triggered HTTP 429 Too Many Requests on request #${i}!"
    break
  fi
  sleep 0.05
done

if [ "${TRIGGERED}" -eq 1 ]; then
  echo ""
  echo "=========================================================="
  echo " ALL ZERO-TRUST AND RATE-LIMIT TESTS PASSED SUCCESSFULLY! "
  echo "=========================================================="
else
  echo "✖ FAIL: Rate limiter did not fire HTTP 429 within 15 requests."
  exit 1
fi
