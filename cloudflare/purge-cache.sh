#!/usr/bin/env bash
# telegram-exporter.plzhans.com 도메인의 Cloudflare 캐시를 퍼지.
# 이 zone(plzhans.com)은 이 사이트 외에도 여러 서비스가 같이 쓰기 때문에
# purge_everything이 아니라 hosts 필터로 telegram-exporter.plzhans.com만 지정해서 퍼지.
#
# 사용법:
#   ./cloudflare/purge-cache.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ZONE_NAME=$(jq -r '.zone_name' "$SCRIPT_DIR/settings.json")
DOMAIN=$(jq -r '.domain' "$SCRIPT_DIR/settings.json")

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env"
  set +a
fi

api() {
  local method="$1" path="$2" data="${3:-}"
  if [ -n "$data" ]; then
    curl -s -X "$method" "https://api.cloudflare.com/client/v4$path" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
      -d "$data"
  else
    curl -s -X "$method" "https://api.cloudflare.com/client/v4$path" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json"
  fi
}

echo "[$DOMAIN] zone 조회 중..."
ZONE_ID=$(api GET "/zones?name=$ZONE_NAME" | jq -r '.result[0].id')
if [ -z "$ZONE_ID" ] || [ "$ZONE_ID" = "null" ]; then
  echo "zone($ZONE_NAME)을 찾지 못했습니다" >&2
  exit 1
fi
echo "zone_id=$ZONE_ID"

echo "[$DOMAIN] 캐시 퍼지 중..."
result=$(api POST "/zones/$ZONE_ID/purge_cache" "$(jq -n --arg host "$DOMAIN" '{hosts: [$host]}')")

ok=$(echo "$result" | jq -r '.success')
if [ "$ok" != "true" ]; then
  echo "실패: $(echo "$result" | jq -c '.errors')" >&2
  exit 1
fi

echo "완료."
