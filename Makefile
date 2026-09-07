# sops + age 로 로컬 설정 파일을 암복호화한다.
#
# 원본(.env, .env.local)은 gitignore 되어 저장소에 없고, 암호문(*.enc)만 커밋한다.
# dotenv 형식이라 값만 암호화되고 변수 이름은 평문으로 남아 diff 로 변경을 확인할 수 있다.
# 확장자가 .enc 라 sops 가 형식을 못 알아채므로 --input-type/--output-type 을 항상 준다.
# 수신자/개인 키 설정은 .sops.yaml 을 참고한다.
#
#   make env encrypt   .env -> .env.enc, .env.local -> .env.local.enc
#   make env decrypt   .env.enc -> .env, .env.local.enc -> .env.local

# 암복호화 대상 원본 파일들. 각각 <파일>.enc 로 짝지어진다.
ENV_FILES ?= .env .env.local

# age 개인 키의 표준 위치. SOPS_AGE_KEY_FILE 환경변수가 실제 파일을 가리키면 그것을,
# 아니면(미설정/경로 오류) 이 표준 위치로 폴백한다.
AGE_KEY_FILE ?= $(HOME)/.config/sops/age/keys.txt
RESOLVE_KEY = key="$${SOPS_AGE_KEY_FILE:-$(AGE_KEY_FILE)}"; [ -f "$$key" ] || key="$(AGE_KEY_FILE)"

.PHONY: env encrypt decrypt

# `make env encrypt` / `make env decrypt` 처럼 접두어로 쓰기 위한 no-op 타깃.
env:
	@:

encrypt:
	@$(RESOLVE_KEY); \
	for f in $(ENV_FILES); do \
	  [ -f "$$f" ] || { echo "건너뜀(원본 없음): $$f"; continue; }; \
	  SOPS_AGE_KEY_FILE="$$key" sops -e --input-type dotenv --output-type dotenv "$$f" > "$$f.enc.tmp" \
	    && mv "$$f.enc.tmp" "$$f.enc" \
	    && echo "암호화 완료: $$f -> $$f.enc" \
	    || { rm -f "$$f.enc.tmp"; exit 1; }; \
	done

decrypt:
	@$(RESOLVE_KEY); \
	for f in $(ENV_FILES); do \
	  [ -f "$$f.enc" ] || { echo "건너뜀(암호문 없음): $$f.enc"; continue; }; \
	  SOPS_AGE_KEY_FILE="$$key" sops -d --input-type dotenv --output-type dotenv "$$f.enc" > "$$f.tmp" \
	    && mv "$$f.tmp" "$$f" \
	    && echo "복호화 완료: $$f.enc -> $$f" \
	    || { rm -f "$$f.tmp"; exit 1; }; \
	done

.PHONY: cloudflare-purge cloudflare-dns cloudflare-rules

cloudflare-purge:
	./cloudflare/purge-cache.sh

cloudflare-dns:
	./cloudflare/manage-dns.sh

cloudflare-rules:
	./cloudflare/manage-rules.sh
