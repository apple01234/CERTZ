# Craft Anything 설치 및 검증

## 설치 범위

사용자의 명시적 지시에 따라 [공식 저장소](https://github.com/storytold/craft-anything)의 공개 Linux x86_64 CLI를 설치했다. 기존 CERTZ 엔진, 앱 코드, 에셋은 변경하지 않았다. `rebuild`, 이미지·오디오 생성, 대상 프로그램 실행은 수행하지 않았다. 기존 분석 도구의 등록과 파일도 제거하지 않았다.

- 확인일(UTC): 2026-11-10
- 공식 release: [v0.6.0](https://github.com/storytold/craft-anything/releases/tag/v0.6.0)
- 참조용 소스 clone: `/workspace/craft-anything`, HEAD `67b95106c2fbb79c57802857f7813d96cfb88c8d` (수정·커밋 없음)
- 설치 실행 파일: `/workspace/tools/craft-anything/craft-anything-cli` (34,695,832 bytes)
- CLI 버전 출력: `craft-anything-cli 0.6.0`
- 프로젝트 의존성 추가·Rust 빌드·GUI 설치 없음. 압축 파일은 디스크 여유를 위해 `/dev/shm/craft-anything-install`에서만 처리했다.

## 원본 및 SHA256

[Linux 배포 archive](https://github.com/storytold/craft-anything/releases/download/v0.6.0/craft-anything-0.6.0-linux-x86_64.tar.gz), [공식 SHA256SUMS](https://github.com/storytold/craft-anything/releases/download/v0.6.0/SHA256SUMS.txt).

| 항목 | 값 |
|---|---|
| Archive 크기 | 69,441,863 bytes |
| Archive SHA256 | `cbc65972a8eb4c89ed74b99bcf14aa5ea0f7aa9da709def38da79ccacc5e07a0` |
| 공식 checksum과 비교 | 일치 |
| 추출 CLI SHA256 | `359c0304bd7a6b367a1a17c0a84a32073b80ce26c603cb675df6d46b1eca4f2a` |
| Archive 내부 CLI | `craft-anything-0.6.0-linux-x86_64/bin/craft-anything-cli` |
| 라이선스 | 공식 소스 기준 MIT OR Apache-2.0 |

공식 checksum 파일과의 일치 여부를 검사했다. 별도의 GPG 서명 인증은 수행하지 않았다. checksum 사본은 설치 디렉터리에 보관했다.

## Codex 등록과 검증

공식 절차를 실행했다:

```sh
/workspace/tools/craft-anything/craft-anything-cli setup --client codex --dry-run
/workspace/tools/craft-anything/craft-anything-cli setup --client codex --yes
/workspace/tools/craft-anything/craft-anything-cli doctor --client codex
/workspace/tools/craft-anything/craft-anything-cli commands
```

- `setup`: `configured`, exit 0.
- 기존 Codex 설정의 새 `craft-anything` 항목 외 의미값이 전후 동일한지 TOML 파싱으로 확인했다. 기존 MCP 서버 1개를 그대로 보존했다.
- 공식 setup이 `config.toml.craft-anything.backup`을 만들었다. 설정 파일 권한은 `0600`이다. 비밀값은 문서·로그 출력에 포함하지 않았다.
- 등록 항목: `[mcp_servers.craft-anything]`, `command = "/workspace/tools/craft-anything/craft-anything-cli"`, `args = ["mcp"]`.
- 공식 스킬: `~/.agents/skills/craft-anything/SKILL.md` 설치 및 읽기 완료.
- `doctor`: 최초 미등록 상태 exit 1 → 등록 후 `healthy: true`, exit 0. 자체 MCP 검사도 통과했다.
- Ghidra, adb, jadx 등 선택적 외부 엔진은 미설치다. 내장 정적 소스 분석은 이 엔진 없이 작동했다. doctor의 healthy는 모든 선택적 엔진 설치를 뜻하지 않는다.
- `commands`: 도구 322개, exit 0.

이 파일 시스템의 Codex MCP 설정과 현재 대화 호스트가 제공하는 도구 목록은 별개다. 설정 파일을 수정했다고 현재 대화에 새 MCP 도구가 자동으로 생겼다고 주장하지 않는다. 재시작·재연결 후 호스트가 이 설정을 읽으면 사용할 수 있으며, 현재 작업에서는 아래 CLI 경로로 바로 호출할 수 있다.

## 실제 MCP stdio smoke

공식 CLI 프로세스의 stdin/stdout으로 JSON-RPC `initialize` → `notifications/initialized` → `tools/list`를 전송하고 응답을 파싱했다. 대상 코드를 실행하지 않았다.

| 실행 | 프로토콜 | 도구 수 | 결과 |
|---|---|---:|---|
| `craft-anything-cli mcp` | 2025-06-18 | 30 | 정상, exit 0 |
| `craft-anything-cli mcp --all-tools` | 2025-06-18 | 108 | 정상, exit 0 |
| `craft-anything-cli --deep mcp --all-tools` | 2025-06-18 | 322 | 정상, exit 0 |

서버 정보: `name: craft-anything`, `version: 0.6.0`. 세 목록 모두 `nextCursor` 없음. Deep + 전체 도구 목록에서 `app_source_import` 존재를 확인했다. 기본 등록은 공식 setup의 Clean room 설정을 유지한다. 따라서 내부 소스 분석은 명시적인 `--deep` CLI 호출 또는 해당 옵션으로 시작한 MCP 서버에서 수행한다. `--all-tools`만으로 Deep 모드가 켜지지는 않는다.

## 실제 CERTZ 정적 분석

기존 게임의 소스 디렉터리를 내장 parser로 분석했다. 별도의 게임·엔진을 만들거나 기존 앱 코드를 실행하지 않았다.

```sh
/workspace/tools/craft-anything/craft-anything-cli --deep \
  --project /workspace/tools/craft-anything/certz-source-audit.cany \
  app-source-import --path /workspace/CERTZ/src/game/entities \
  --max-files 30 --max-file-bytes 2097152 --max-total-bytes 8388608
```

첫 실행의 project 위치는 `/dev/shm/certz-source-audit.cany`였으며, 생성된 작은 조사 원장을 위 설치 디렉터리로 보존했다. 기록 시 CERTZ HEAD는 `3908f63d1b5fce7514a1cc8a40b1e8ecc2613c71`이었다. 작업 트리 분석이므로 아래 파일 해시가 실제 입력의 식별값이다.

- exit 0, stderr 없음.
- 요약: `entities: 9 file(s), 9 script(s) analysed, 0 ignored.`
- 총 731,161 bytes, TypeScript 9개, 모두 `parse_mode: parsed`.
- coverage: `complete`, examined 9. 이 하위 폴더에 대한 분석 범위이며 전체 저장소를 모두 분석했다는 뜻은 아니다.
- engine: `builtin 0.6.0`, host: `linux-x86_64`, `clean_room: false`.
- 증거 ID: `ev_65b0f9cc6432b8b74d3925ea94bba9cb49e822c8875281dacd4c7d55613943d9`
- 소스 그래프: `sg_5abfb6a9216136c6d30babbab85425143f7c336a389824d50c875dd18a3cbe5d`
- 원장에 brief·완료 계획·관찰 finding·handoff를 기록했다.

| 파일 | bytes | 파서가 찾은 함수 수 | SHA256 |
|---|---:|---:|---|
| `Boss.ts` | 114093 | 94 | `e2403b23d811fa9573f1b074b906472d0f4f234d99956c61a6ad48e2d42ef46a` |
| `Drop.ts` | 4490 | 5 | `1c3896eb70b7e09737050895c5d7d8ac0b2f0093214345022d715b9cf3122cb6` |
| `Enemy.ts` | 64053 | 32 | `5b660ceab80afb9735e1ddca5e591f8934898822b519d98b88c3593c198a4b5d` |
| `Pet.ts` | 2958 | 2 | `09a1e4fa29bc2f301f79b2856e4f0038ec8e029c49f8b6de17d8d9e437f01071` |
| `Player.ts` | 514573 | 281 | `7b387847b204fe8633e8556bb2754bb695e401851eb00b2388744aaa74eefc90` |
| `StoryBossMechanics.ts` | 7482 | 12 | `bdaaf20eb93aea050eb3acc1daa3ab90ffa451ed889a4283db89ba762d16aa06` |
| `bossDesign.ts` | 9692 | 4 | `ad6dcdbeded6f28655512143703aefed819a11944f22c7cc41d496779009598e` |
| `bossPhases.ts` | 10244 | 9 | `e7ad02db57281cabd87fcc4bc060a6de063a11fc68c1dc3b9867e2db1084cb4b` |
| `storyBossPatterns.ts` | 3576 | 4 | `efb53711a3ccfb59671bbc23ae781088a12ebda289754f5a9fb0357d36102697` |

각 파일의 import, export, 함수명, 문자열과 구조 fingerprint가 반환되었다. 함수 수는 도구의 정적 parser 결과이며 호출 가능성·도달 가능성·실제 전투 동작을 보증하지 않는다.

## 다음 작업에서 사용하는 방법과 한계

```sh
# 명령 옵션을 먼저 확인한다.
/workspace/tools/craft-anything/craft-anything-cli js-app-map --help
/workspace/tools/craft-anything/craft-anything-cli core-target-open --help

# 보존한 조사 원장의 상태/인계 확인
/workspace/tools/craft-anything/craft-anything-cli --deep \
  --project /workspace/tools/craft-anything/certz-source-audit.cany core-investigation-show

# 내부 파일을 읽는 도구가 필요한 MCP 클라이언트에서 명시적으로 시작
/workspace/tools/craft-anything/craft-anything-cli --deep mcp --all-tools
```

설치된 스킬은 소스가 이미 있으면 소스를 직접 읽는 것을 권한다. 게임 수정은 기존 소스와 테스트를 중심으로 진행하고, 배포 JS·APK·게임 archive의 구조나 추출 결과를 확인할 때 Craft Anything의 내장 분석 도구를 사용한다.

이번 증거에는 `reference_claim` 한계가 있다: 소스 트리와 실제 배포본이 같은지 비교하지 않았다. APK, 기존 참고 게임, 전투 모션·컷씬·입력·화면 동작은 이 설치 smoke로 검증되지 않는다. 정적 분석 결과를 런타임 QA 완료로 표시하지 않는다. 사용자 지시상 `rebuild`와 에셋 생성 명령은 사용하지 않는다.

검증 원본 JSON은 `/dev/shm/craft-anything-install/`에 있으며 tmpfs라 환경 재시작 시 사라질 수 있다. 핵심 버전·해시·명령·결과는 이 문서에, 정적 증거와 조사 원장은 `/workspace/tools/craft-anything/certz-source-audit.cany`에 보존했다.
