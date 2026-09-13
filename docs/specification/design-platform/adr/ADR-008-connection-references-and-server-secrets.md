# ADR-008: connection reference와 서버 보관 credential

- 상태: 적용됨
- 결정일: 2026-09-12
- 적용 범위: Binding, 외부 provider, MCP/HTTP connector

## 맥락

Workbench 정의가 token, header 또는 fetch URL을 포함하면 게시 snapshot, 로그와 브라우저에
비밀이 복제되고 SSRF 경계도 우회된다. 현행 integration과 MCP token 계약은 credential을 서버
측 암호화 경계에서 관리한다.

## 결정

Workbench Binding은 권한이 확인되는 `connection_id`와 allowlisted operation 이름만 저장한다.
credential, OAuth verifier, refresh token, webhook secret, raw header, arbitrary URL 및 provider
response body는 정의와 browser result에 넣지 않는다. `platform-core`는 Connection 식별자와
capability port만 사용하고, `platform-adapters`가 encrypted secret, OAuth, MCP client와 HTTP
connector를 구현한다. 호출마다 사용자·조직·Workspace, token scope, connection scope와 operation
권한을 재검사한다. outbound URL은 allowlist, DNS 재검사, redirect 및 byte/time bound를 적용한다.

## 대안

- 정의에 환경변수 이름 또는 header 저장: 배포별 의미와 노출 위험 때문에 제외한다.
- 브라우저에서 provider 직접 호출: credential과 tenant 정책을 우회하므로 제외한다.

## 결과와 적용

현행 `app/modules/integration`, `app/modules/mcp_connection`, `app/mcp/integrations.py` 및 secret
infrastructure는 adapter 포팅 입력이다. 기존 auth와 암호문은 새 connection schema로 자동 확대하거나
재발급하지 않는다. integrations/MCP/security 계약은 `info-platform`/`design-platform`/`rule-platform`이 소유한다. compatibility
adapter 제거 조건은 OAuth/token 갱신, credential 비노출, cancellation/retry, provider fixture,
RLS/SSRF와 실제 rollback 검증이며 live provider 호출은 별도 명시 권한 없이는 수행하지 않는다.
