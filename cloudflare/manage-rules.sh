#!/usr/bin/env bash
# telegram-exporter.plzhans.com 의 Cache Rules / Transform Rules(응답 헤더)를 관리한다.
#
# **이 zone(plzhans.com)은 우리 것이 아니다.** blog·resume·hugosample 등 다른 서비스가
# 같이 쓰고, Cloudflare 는 zone 당 phase 별로 ruleset 이 하나뿐이라 그 하나를 여럿이
# 공유한다. 그래서 ruleset 을 통째로 쓰는 방식(Terraform 의 cloudflare_ruleset 등)은
# 남의 규칙까지 지운다. 대신 Rulesets API 의 **개별 rule 엔드포인트**로 `ref` 가 맞는
# 우리 규칙만 찾아 고친다. 남의 규칙은 절대 안 건드린다.
#
# 같은 이유로 `rules/**/*.json` 의 `ref` 에는 전부 `telegram-exporter` 가 들어간다.
# zone 안에서 유일해야 하고, 이미 배포된 값이라 **바꾸면 새 규칙이 하나 더 생긴다.**
# 파일 이름은 바꿔도 되지만 `ref` 는 건드리지 말 것.
#
# 사용법:
#   ./cloudflare/manage-rules.sh          # rules/ 밑 모든 규칙을 적용(idempotent)
#   make cloudflare-rules
#
# 새 규칙 추가: cloudflare/rules/<phase>/<이름>.json 을 만든다.
# 규칙 삭제는 자동으로 안 한다 - 남의 규칙을 지우는 사고를 막으려고, 삭제는 rule id 를
# 정확히 지정해 수동으로 curl DELETE 할 것.

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

for phase_dir in "$SCRIPT_DIR"/rules/*/; do
  phase=$(basename "$phase_dir")
  rule_files=("$phase_dir"*.json)
  [ -e "${rule_files[0]}" ] || continue

  echo
  echo "=== phase: $phase ==="
  entrypoint=$(api GET "/zones/$ZONE_ID/rulesets/phases/$phase/entrypoint")
  ok=$(echo "$entrypoint" | jq -r '.success')
  if [ "$ok" != "true" ]; then
    echo "entrypoint 조회 실패: $(echo "$entrypoint" | jq -c '.errors')" >&2
    exit 1
  fi
  ruleset_id=$(echo "$entrypoint" | jq -r '.result.id')
  existing_rules=$(echo "$entrypoint" | jq -c '.result.rules')

  for f in "${rule_files[@]}"; do
    ref=$(jq -r '.ref' "$f")
    existing_id=$(echo "$existing_rules" | jq -r --arg ref "$ref" '.[] | select(.ref == $ref) | .id')

    if [ -n "$existing_id" ] && [ "$existing_id" != "null" ]; then
      echo "- [$ref] 기존 규칙 업데이트 (id=$existing_id)"
      result=$(api PATCH "/zones/$ZONE_ID/rulesets/$ruleset_id/rules/$existing_id" "$(cat "$f")")
    else
      echo "- [$ref] 새 규칙 생성"
      result=$(api POST "/zones/$ZONE_ID/rulesets/$ruleset_id/rules" "$(cat "$f")")
    fi

    ok=$(echo "$result" | jq -r '.success')
    if [ "$ok" != "true" ]; then
      echo "  실패: $(echo "$result" | jq -c '.errors')" >&2
      exit 1
    fi
    echo "  OK"
  done
done

echo
echo "완료."
