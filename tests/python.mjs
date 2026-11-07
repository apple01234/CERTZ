// 테스트 전용 — Python 실행 파일 해석.
//
// [왜 필요한가] 여러 테스트가 'python3' 를 하드코딩했는데, Windows 에는 python3 가 없고
//  'python' 이나 py 런처만 있다. 그래서 PIL 검증 테스트가 **플랫폼 문제로** 전부 실패했다.
//  (실제 코드 결함이 아니라 실행 경로 문제 — 회귀 원인이 가려졌다.)
//
// [해결] PIL 이 실제로 import 되는 인터프리터를 한 번 찾아 캐시하고, 없으면 명확히 실패한다.
//  REA_PYTHON 환경변수로 강제 지정할 수 있다.
import { execFileSync } from 'node:child_process';

let cached;

/* vc274 — Windows 기본 코드페이지(cp949)로 자식 파이썬이 한글 경로/출력을 디코드하다
 *  UnicodeDecodeError 로 죽는 문제를 막는다. PYTHONUTF8 은 Python 3.7+ 표준이며
 *  다른 플랫폼에서는 이미 UTF-8 이라 무해하다. */
const PY_ENV = { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' };

/** PIL 이 import 되는 Python 실행 파일 경로.
 *
 *  vc274 — 후보에 **번들 런타임 경로**를 추가했다. 이 저장소의 개발 환경에는 시스템
 *  python/python3 가 없고 DSH 번들 런타임에만 Pillow 가 들어 있어, 종전엔 REA_PYTHON 을
 *  매번 수동으로 export 해야 테스트가 돌았다(안 하면 "플랫폼 문제"로 오인됐다).
 *  번들 경로가 없는 다른 환경에서는 그냥 다음 후보로 넘어가므로 무해하다. */
const BUNDLED = [
  'C:/Users/apple/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/python.exe',
];

export function pythonBin() {
  if (cached) return cached;
  const candidates = [process.env.REA_PYTHON, ...BUNDLED, 'python3', 'python', 'py'].filter(Boolean);
  for (const c of candidates) {
    try {
      execFileSync(c, ['-c', 'import PIL'], { stdio: 'ignore', env: PY_ENV });
      cached = c;
      return c;
    } catch {
      /* 다음 후보 */
    }
  }
  throw new Error(
    `Pillow(PIL) 가 있는 Python 을 찾지 못했다. 시도: ${candidates.join(', ')}. ` +
      `REA_PYTHON 환경변수로 인터프리터를 지정하라.`,
  );
}

/** 자식 파이썬에 넘길 env — UTF-8 강제. 테스트가 execFileSync 로 직접 띄울 때 쓴다. */
export const pythonEnv = PY_ENV;
