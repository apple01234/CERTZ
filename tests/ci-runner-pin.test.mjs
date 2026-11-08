/**
 * CI 러너 이미지가 `-latest` 로 되돌아가지 않게 하는 계약 (REVAMP_100 #28).
 *
 * [왜 필요한가]
 *  `runs-on: ubuntu-latest` 는 GitHub 가 러너 이미지를 올릴 때마다 조용히 바뀐다.
 *  이 저장소의 워크플로는 Android SDK 경로·JDK·Gradle 캐시에 의존하므로, 이미지가
 *  바뀌면 코드 변경이 없는데도 빌드가 깨진다. 원인을 찾기 어려운 종류의 실패다.
 *
 *  2026-10-19 부터 `ubuntu-latest` 가 새 버전으로 이동 중이라 24.04 로 핀했다.
 *  이 테스트는 그 핀이 유지되는지 확인한다 — 누군가 편하다고 `-latest` 로 되돌리면
 *  여기서 잡힌다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";

const DIR = ".github/workflows";

function workflows() {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .map((f) => ({ name: f, src: readFileSync(`${DIR}/${f}`, "utf8") }));
}

test("워크플로 파일이 실제로 있다 (빈 목록으로 통과 방지)", () => {
  const wf = workflows();
  assert.ok(wf.length >= 3, `워크플로가 ${wf.length}개뿐이다`);
});

test("어떤 워크플로도 `-latest` 러너를 쓰지 않는다", () => {
  const offenders = [];
  for (const wf of workflows()) {
    /* 주석 줄은 제외 — 설명에 "-latest 가 문제였다"고 적는 것은 막지 않는다. */
    const lines = wf.src.split("\n").filter((l) => !/^\s*#/.test(l));
    for (const l of lines) {
      const m = /^\s*runs-on:\s*(\S+)/.exec(l);
      if (m && /-latest$/.test(m[1])) offenders.push(`${wf.name}: ${m[1]}`);
    }
  }
  assert.deepEqual(offenders, [], `-latest 러너 사용: ${offenders.join(", ")}`);
});

test("ubuntu 러너는 24.04 로 핀돼 있다", () => {
  const wf = workflows().find((w) => w.name === "android-build.yml");
  assert.ok(wf, "android-build.yml 이 없다");
  const m = /^\s*runs-on:\s*(ubuntu-\S+)/m.exec(wf.src);
  assert.ok(m, "android-build.yml 에 runs-on 이 없다");
  assert.equal(m[1], "ubuntu-24.04", `ubuntu 러너가 ${m[1]} 이다`);
});

test("windows 러너는 2022 로 핀돼 있다", () => {
  /* rcedit(exe 아이콘·버전 리소스)와 NSIS 가 Windows 이미지 버전에 민감하다. */
  const wf = workflows().find((w) => w.name === "exe-build.yml");
  assert.ok(wf, "exe-build.yml 이 없다");
  const m = /^\s*runs-on:\s*(windows-\S+)/m.exec(wf.src);
  assert.ok(m, "exe-build.yml 에 runs-on 이 없다");
  assert.equal(m[1], "windows-2022", `windows 러너가 ${m[1]} 이다`);
});

test("macOS 러너는 메이저 버전으로 핀돼 있다", () => {
  /* macos-15 는 이미 버전이 박힌 이름이라 -latest 가 아니다. 형식만 확인한다. */
  const wf = workflows().find((w) => w.name === "ios-build.yml");
  assert.ok(wf, "ios-build.yml 이 없다");
  const m = /^\s*runs-on:\s*(macos-\S+)/m.exec(wf.src);
  assert.ok(m, "ios-build.yml 에 runs-on 이 없다");
  assert.match(m[1], /^macos-\d+$/, `macOS 러너가 ${m[1]} — macos-NN 형식이어야 한다`);
});

test("러너 이미지를 올릴 때 고칠 곳이 한 군데뿐이다", () => {
  /* 같은 OS 러너를 쓰는 워크플로가 여럿이면 하나만 올려서 어긋난다.
   * 현재 ubuntu 1개(android) · windows 1개(exe) · macos 1개(ios) 다. */
  const byOs = (re) => workflows().filter((w) => re.test(w.src)).map((w) => w.name);
  for (const [os, re] of [["ubuntu", /runs-on:\s*ubuntu-/], ["windows", /runs-on:\s*windows-/], ["macos", /runs-on:\s*macos-/]]) {
    const list = byOs(re);
    assert.ok(list.length <= 1, `${os} 러너를 쓰는 워크플로가 ${list.length}개다: ${list.join(", ")}`);
  }
});
