#!/usr/bin/env bash
# telegram-exporter.plzhans.com 의 DNS 레코드를 관리한다.
#
# **zone(plzhans.com)에는 우리와 무관한 레코드가 훨씬 많다** - blog·resume·_dmarc·SPF
# 등. 이 스크립트는 `dns/*.json` 에 적힌 name+type 이 정확히 일치하는 레코드만 건드린다.
#
# 이 도메인은 GitHub Pages 를 가리키면서 **프록시를 켠다**(`proxied: true`). 회색 구름이면
# Cloudflare 를 안 거치므로 Transform Rule 이 닿지 못하고, 그러면 보안 헤더가 하나도 안
# 붙는다 - 특히 `frame-ancestors` 는 `<meta>` 로는 무시되어 클릭재킹 방어가 0 이 된다
# (`rules/http_response_headers_transform/security-headers.json` 참고).
#
# 프록시를 켜는 대가로 응답이 Cloudflare 엣지를 한 번 더 거친다. 되돌리려면 `proxied` 를
# `false` 로 바꾸고 다시 실행하면 즉시 GitHub Pages 직결로 돌아간다.
#
# 사용법:
#   ./cloudflare/manage-dns.sh            # dns/ 밑 모든 레코드를 적용(idempotent)
#   make cloudflare-dns
#
# 레코드 삭제는 자동으로 안 한다 - 남의 레코드를 지우는 사고를 막으려고, 삭제는 record id
# 를 정확히 지정해 수동으로 curl DELETE 할 것.

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
echo

for f in "$SCRIPT_DIR"/dns/*.json; do
  [ -e "$f" ] || continue
  name=$(jq -r '.name' "$f")
  type=$(jq -r '.type' "$f")

  existing_id=$(api GET "/zones/$ZONE_ID/dns_records?name=$name&type=$type" | jq -r '.result[0].id // empty')

  if [ -n "$existing_id" ]; then
    echo "- [$type $name] 기존 레코드 업데이트 (id=$existing_id)"
    result=$(api PATCH "/zones/$ZONE_ID/dns_records/$existing_id" "$(cat "$f")")
  else
    echo "- [$type $name] 새 레코드 생성"
    result=$(api POST "/zones/$ZONE_ID/dns_records" "$(cat "$f")")
  fi

  ok=$(echo "$result" | jq -r '.success')
  if [ "$ok" != "true" ]; then
    echo "  실패: $(echo "$result" | jq -c '.errors')" >&2
    exit 1
  fi
  echo "  OK"
done

echo
echo "완료."
