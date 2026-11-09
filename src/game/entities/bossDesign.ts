/** Canon battle identities. Earlier approved documents take precedence over older episode notes. */
export type BossPhaseDesign = {
  readonly at: number; readonly form: string; readonly patterns: readonly string[];
  readonly canon: string; readonly note: string; readonly visual?: string;
};
export type BossDesign = {
  readonly name: string; readonly motive: string; readonly power: string; readonly visual: string;
  readonly phases: readonly BossPhaseDesign[]; readonly finish?: "repel" | "ringout" | "core";
};
const phase = (at: number, form: string, patterns: string[], canon: string, note: string, visual?: string): BossPhaseDesign =>
  ({ at, form, patterns, canon, note, ...(visual ? { visual } : {}) });
export const CANON_BOSS_DESIGN = {
  dio: { name: "디오", motive: "검을 찾기 위해 마을을 습격한다.", power: "다크니스 크리스탈의 힘 · 사념체", visual: "cast_dio", finish: "repel", phases: [
    phase(1, "보석의 힘", ["charge", "summon"], "1.txt:110-137", "사념체로 주민과 기사단을 압박한다."),
    phase(.55, "사념체의 벽", ["shadowcopies", "zones"], "1.txt:137-159", "사념체를 모아 벽을 만들고 하루를 가로막는다."),
  ] },
  harold: { name: "해롤드", motive: "남부 해전의 군단장.", power: "저주받은 바다 · 크라켄 · 먹물", visual: "cast_harold", finish: "repel", phases: [
    phase(1, "바다의 군단장", ["charge", "volley"], "4.txt:103-104", "무기는 없다. 삼지창은 카르텔의 무기다."),
    phase(.55, "크라켄", ["tentacleslam", "inkflood", "ring"], "5.txt:169-175", "저주받은 바다의 힘으로 크라켄이 되어 먹물과 고대의 힘을 쓴다.", "story_kraken"),
  ] },
  verodin: { name: "베로니카와 딘", motive: "칼리야 전선의 저주와 흑마법 군단장.", power: "저주받은 지팡이 · 흑마법의 지팡이", visual: "cast_veronica", finish: "repel", phases: [
    phase(1, "저주받은 지팡이", ["zones", "volley"], "4.txt:103-104", "베로니카의 저주를 바닥 예고와 탄막으로 드러낸다."),
    phase(.55, "저주와 흑마법", ["cursefield", "summon"], "2.txt:63-89", "두 군단장의 장판과 사념체 압박. 무관한 얼음·화염 마법을 추가하지 않는다."),
  ] },
  rasion: { name: "라시온", motive: "하루의 검을 알아보고 살의를 품는다.", power: "검술 · 강인한 육체 · 고대의 재앙", visual: "cast_rasion", finish: "repel", phases: [
    phase(1, "고대의 검사", ["charge", "counter"], "2.txt:121-125", "검을 휘두르는 강한 검사이며 드래곤이 아니다."),
    phase(.5, "지치지 않는 재앙", ["blinkslash", "counter", "charge"], "2.txt:121-125", "강한 검술과 연속 압박. 새로운 원소를 임의로 부여하지 않는다."),
  ] },
  feron: { name: "페르온", motive: "라일락의 죽음 뒤 힘을 좇다가 세뇌당했다.", power: "다크엑스칼리버 · 그림자", visual: "cast_feron", finish: "repel", phases: [
    phase(1, "다크엑스칼리버", ["charge", "blinkslash"], "4.txt:100-102", "암흑의 검을 쓰는 인간 기사다."),
    phase(.5, "그림자의 분신", ["shadowcopies", "counter"], "4.txt:100-102", "그림자로 시야를 가리고 분신으로 공격한다. 검은 드래곤의 영혼을 품었다는 설정을 육체 변신으로 바꾸지 않는다."),
  ] },
  shadow: { name: "군단장의 사념체", motive: "성채의 비밀 통로를 막는다.", power: "사념체 · 군단장의 잔재", visual: "cast_feron", finish: "repel", phases: [
    phase(1, "군단장의 사념", ["blinkslash", "volley"], "2.txt:158-162", "최상층으로 가는 길을 지키는 군단장들의 사념체."),
    phase(.5, "사념체의 함정", ["shadowcopies", "zones"], "2.txt:158-162", "반란군이 길을 열기 위해 대신 막아선다."),
  ] },
  scarlet_blood: { name: "스칼렛", motive: "원혈로 원소를 흡수하며 연합과 대적한다.", power: "카타나 · 피의 원소", visual: "cast_scarlet", finish: "repel", phases: [
    phase(1, "원혈", ["blinkslash", "bloodseal"], "2.txt:162-166", "원혈의 흡수와 근접 돌파를 구분한다."),
    phase(.55, "피의 영역", ["bloodseal", "ring", "volley"], "2.txt:162-166", "피의 영역과 폭혈일섬. 얼음·불 기둥을 섞지 않는다."),
  ] },
  scarlet_dark: { name: "스칼렛", motive: "흡수 대신 잠식으로 판도를 뒤집는다.", power: "어둠의 잠식 · 카타나", visual: "cast_scarlet", finish: "repel", phases: [
    phase(1, "어둠의 잠식", ["corruption", "blinkslash"], "2.txt:165-205", "닿은 곳이 어둠으로 물드는 잠식."),
    phase(.5, "피와 어둠", ["corruption", "bloodseal", "beam"], "2.txt:200-205", "피와 어둠의 힘으로 압박한다."),
  ] },
  scarlet_seal: { name: "스칼렛", motive: "페르온의 영역을 벗어나 루시를 제압하려 한다.", power: "카타나 · 피와 어둠", visual: "cast_scarlet", finish: "repel", phases: [
    phase(1, "봉쇄된 영역", ["counter", "blinkslash"], "2.txt:208-221", "페르온이 가둔 일 분 동안 동료가 힘을 준비한다."),
    phase(.5, "마지막 저항", ["bloodseal", "corruption"], "2.txt:221-241", "전투 종료는 이 국면의 격퇴이며 스칼렛의 사망이 아니다."),
  ] },
  scarlet: { name: "스칼렛", motive: "원혈에서 어둠의 잠식으로 이어지는 연합전의 전투 기록.", power: "카타나 · 피와 어둠", visual: "cast_scarlet", finish: "repel", phases: [
    phase(1, "원혈", ["bloodseal", "blinkslash"], "2.txt:162-166", "카타나와 피의 원소."),
    phase(.66, "어둠의 잠식", ["corruption", "beam"], "2.txt:165-205", "흡수와 잠식은 같은 능력이 아니다."),
    phase(.33, "빛을 향한 틈", ["counter", "ring"], "2.txt:208-241", "전쟁의 국면을 재현하며 임의의 원소 변신을 추가하지 않는다."),
  ] },
  desknis: { name: "데스크니스", motive: "세계와 영혼을 잠식해 새로운 세계를 만들려 한다.", power: "잠식 · 영혼 · 고대의 공포", visual: "story_desknis", finish: "repel", phases: [
    phase(1, "고대의 공포", ["corruption", "blinkslash"], "2.txt:247-277", "어둠과 영혼에 대한 공격."),
    phase(.6, "잠식된 세계", ["corruption", "shadowcopies"], "2.txt:280-294", "하루가 자신의 본질과 무의 원소를 깨닫는 국면."),
    phase(.3, "무한한 시간선", ["corruption", "portalteleport"], "2.txt:298-307", "끝은 리엘의 시간선 개입이며 세계 복원이 사망자의 부활을 뜻하지 않는다."),
  ] },
  littlestar: { name: "리틀스타", motive: "스타게이트의 문지기가 방문자의 힘을 이용한다.", power: "행성 · 장미의 동력", visual: "cast_littlestar", finish: "core", phases: [
    phase(1, "장미의 동력", ["rosecore", "zones"], "8.txt:37-53", "장미가 행성을 움직이는 동력원이다."),
    phase(.5, "뒤틀리는 행성", ["rosecore", "quake"], "8.txt:53-65", "지면을 뒤틀며 이동을 방해한다.", "story_starplanet"),
  ] },
  jade: { name: "제이드", motive: "마법수정의 힘과 동료들을 흡수한다.", power: "흡수 · 에너지 분신 · 방어막", visual: "cast_jade", finish: "repel", phases: [
    phase(1, "마법수정의 힘", ["beam", "shieldcast"], "8.txt:118-140", "중앙 코어와 마법수정의 힘."),
    phase(.55, "에너지 분신", ["jadeclones", "crystalburst"], "8.txt:118-140", "분신과 방어막을 이용한 에너지 압박."),
  ] },
  reversecore: { name: "컨트롤타워 AI", motive: "도시에 독가스를 공급하는 장치를 멈춘다.", power: "독가스 · 기계 장치", visual: "story_aicore", finish: "core", phases: [
    phase(1, "독가스 공급", ["cursefield", "zones"], "8.txt:245-304", "환기 통로를 읽고 독가스 예고를 피한다."),
    phase(.5, "중앙 제어", ["beam", "corruption"], "8.txt:245-304", "기계의 직선 방어망 사이 안전 구간."),
  ] },
  fabian: { name: "힘의 부호 파비앙", motive: "컴퍼니가 만든 카르텔의 데이터와 링에서 대련한다.", power: "체술 · 밀어내기", visual: "cast_fabian", finish: "ringout", phases: [
    phase(1, "링 위의 대련", ["charge", "slam"], "8.txt:402-433", "무기를 새로 쥐여 주지 않는다."),
    phase(.5, "링 아웃", ["ringpush", "counter"], "8.txt:522-530", "상대를 잡아 링 밖으로 밀려는 움직임과 역이용."),
  ] },
} as const satisfies Record<string, BossDesign>;
export type CanonBossKey = keyof typeof CANON_BOSS_DESIGN;
/** Existing optional maps replay documented encounters; these aliases do not create new canon people. */
export const BOSS_RECORD_ALIASES: Record<string, CanonBossKey> = {
  guardian: "reversecore", behemoth: "jade", abysslord: "littlestar", nidhog: "desknis", surt: "scarlet_dark",
  fenrir: "rasion", skoll: "littlestar", gram: "verodin", abudditos: "scarlet", vord: "reversecore", jorm: "harold", nagr: "desknis",
};
export function canonBossOf(key: string): BossDesign | null {
  const id = BOSS_RECORD_ALIASES[key] ?? key;
  return (CANON_BOSS_DESIGN as Record<string, BossDesign>)[id] ?? null;
}
export function canonPhaseIndex(key: string, hp01: number): number {
  const d = canonBossOf(key); if (!d) return -1;
  const r = Number.isFinite(hp01) ? hp01 : 0; let idx = 0;
  for (let i = 0; i < d.phases.length; i++) if (r <= d.phases[i].at) idx = i;
  return idx;
}
export function canonPatternsAt(key: string, hp01: number): string[] {
  const d = canonBossOf(key); if (!d) return [];
  return [...new Set(d.phases.slice(0, canonPhaseIndex(key, hp01) + 1).flatMap((p) => [...p.patterns]))];
}
