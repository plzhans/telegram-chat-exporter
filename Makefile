# sops + age 로 로컬 설정 파일을 암복호화한다.
#
# 원본(.env.local)은 gitignore 되어 저장소에 없고, 암호문(.env.local.enc)만 커밋한다.
# dotenv 형식이라 값만 암호화되고 변수 이름은 평문으로 남아 diff 로 변경을 확인할 수 있다.
# 확장자가 .enc 라 sops 가 형식을 못 알아채므로 --input-type/--output-type 을 항상 준다.
# 수신자/개인 키 설정은 .sops.yaml 을 참고한다.
#
#   make env encrypt   .env.local  -> .env.local.enc
#   make env decrypt   .env.local.enc -> .env.local

ENV_FILE ?= .env.local
ENC_FILE ?= $(ENV_FILE).enc

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
	SOPS_AGE_KEY_FILE="$$key" sops -e --input-type dotenv --output-type dotenv $(ENV_FILE) > $(ENC_FILE).tmp \
	  && mv $(ENC_FILE).tmp $(ENC_FILE) \
	  && echo "암호화 완료: $(ENV_FILE) -> $(ENC_FILE)" \
	  || { rm -f $(ENC_FILE).tmp; exit 1; }

decrypt:
	@$(RESOLVE_KEY); \
	SOPS_AGE_KEY_FILE="$$key" sops -d --input-type dotenv --output-type dotenv $(ENC_FILE) > $(ENV_FILE).tmp \
	  && mv $(ENV_FILE).tmp $(ENV_FILE) \
	  && echo "복호화 완료: $(ENC_FILE) -> $(ENV_FILE)" \
	  || { rm -f $(ENV_FILE).tmp; exit 1; }
