/** Location/encounter bindings from the eight approved documents, in their precedence order.
 * A place without an encounter is deliberately not given an invented story boss. */
export type TerrainMaterial = "grass" | "sand" | "rock" | "water" | "wood" | "castle" | "earth" | "snow" | "machine" | "ruin" | "astral" | "volcano" | "forest";
export type Place = {
  title: string; floor: TerrainMaterial; path: TerrainMaterial; border: TerrainMaterial;
  role: "cliff" | "village" | "ruin" | "dungeon" | "inn" | "court" | "observatory" | "harbor" | "deck" | "shore" | "sanctuary" | "road" | "camp" | "tunnel" | "throne" | "domain" | "rift" | "garden" | "factory" | "city" | "ring";
  boss?: string;
};
export type ChapterStoryPlan = { title: string; canon: string; places: Place[]; training?: boolean };
const place = (title: string, role: Place["role"], floor: TerrainMaterial, path: TerrainMaterial = floor, border: TerrainMaterial = "rock", boss?: string): Place => ({ title, role, floor, path, border, ...(boss ? { boss } : {}) });

export const CHAPTER_STORY_PLAN: Record<string, ChapterStoryPlan> = {
  howlrstone1: { title: "절벽의 약속", canon: "1.txt:4-34", places: [
    place("라일락과 만난 절벽", "cliff", "grass", "earth"), place("마을의 수련터", "village", "grass", "earth"),
    place("에델리오나 성의 뒷문", "court", "castle"), place("검이 잠든 지하 감옥", "dungeon", "ruin", "castle"),
  ] },
  howlrstone2: { title: "떠나야 할 이유", canon: "1.txt:62-174", places: [
    place("습격당한 마을", "village", "earth", "castle"), place("피난 골목", "ruin", "ruin", "earth"),
    place("디오와 사념체", "court", "ruin", "castle", "rock", "dio"), place("시스터즈의 아지트", "inn", "wood"),
  ] },
  howlrstone3: { title: "칼리야의 수련", canon: "2.txt:35-45", places: [
    place("칼리야로 가는 길", "road", "grass", "earth"), place("도깨비들의 언덕", "cliff", "forest", "earth"),
    place("리엘의 주막", "inn", "wood"), place("원소 순환 수련장", "court", "earth", "castle"), place("에벤트로 향하는 길", "road", "grass", "earth"),
  ] },
  howlrstone4: { title: "벨리카와 에벤트", canon: "2.txt:46-61", places: [
    place("우편배달 길", "road", "grass", "earth"), place("대공립천문대", "observatory", "castle", "astral"),
    place("에벤트 외곽", "village", "grass", "castle"), place("왕국의 수련뜰", "court", "castle", "earth"),
  ] },
  howlrstone5: { title: "남부의 해전", canon: "2.txt:59-71", places: [
    place("남부 방어선", "camp", "grass", "earth"), place("에스테반 항만", "harbor", "sand", "wood", "water"),
    place("전함의 갑판", "deck", "wood", "wood", "water"), place("해롤드의 크라켄", "shore", "sand", "wood", "water", "harold"),
  ] },
  howlrstone6: { title: "루시의 상처", canon: "2.txt:90-103", places: [
    place("생명의 영역 입구", "garden", "forest", "grass"), place("숲의 치료소", "sanctuary", "grass", "castle"),
    place("다크니스의 상흔", "sanctuary", "ruin", "forest"), place("보석의 힘 흡수", "court", "castle", "forest"),
  ] },
  howlrstone7: { title: "이동석과 고대의 재앙", canon: "2.txt:73-125", places: [
    place("칼리야 전선", "camp", "earth", "castle"), place("군단장의 전초", "ruin", "ruin", "earth"),
    place("저주와 흑마법의 진지", "court", "ruin", "castle", "rock", "verodin"),
    place("이동석 설치 지점", "observatory", "castle", "earth"), place("라시온과의 결투", "court", "earth", "castle", "rock", "rasion"),
  ] },
  howlrstone8: { title: "잃어버린 라일락의 기억", canon: "2.txt:129-143", places: [
    place("에벤트 성문", "court", "castle"), place("두 전사의 전장", "court", "earth", "castle"),
    place("무너진 유적", "ruin", "ruin", "earth"), place("아리와 페르온의 격전", "court", "castle", "castle", "rock", "feron"),
    place("기억을 돌려주는 펜던트", "garden", "grass", "castle"),
  ] },
  howlrstone9: { title: "연합의 재집결", canon: "2.txt:144-156", places: [
    place("연합 집결지", "camp", "grass", "earth"), place("부상자 치료 천막", "sanctuary", "grass", "wood"),
    place("성채 결계 외곽", "ruin", "ruin", "castle"), place("반란군이 연 돌입로", "road", "earth", "castle"),
  ] },
  howlrstone10: { title: "시스터즈의 비밀 통로", canon: "2.txt:158-162", places: [
    place("어둠의 성채 외벽", "ruin", "ruin", "castle"), place("군단장의 사념체", "court", "castle", "ruin", "rock", "shadow"),
    place("지하의 미로", "tunnel", "ruin", "castle"), place("스칼렛의 함정", "tunnel", "castle", "ruin"), place("시스터즈의 방어선", "tunnel", "ruin", "castle"),
  ] },
  howlrstone11: { title: "피의 영역", canon: "2.txt:162-166", places: [
    place("왕좌의 전실", "throne", "castle"), place("원혈의 의식", "domain", "castle", "ruin"),
    place("근접 돌파", "court", "castle"), place("스칼렛의 피의 영역", "throne", "castle", "castle", "rock", "scarlet_blood"),
  ] },
  howlrstone12: { title: "원소가 반응하는 순간", canon: "2.txt:167-205", places: [
    place("중첩된 영역", "domain", "astral", "castle"), place("원소의 반응", "domain", "castle", "astral"),
    place("마지막 자연의 힘", "garden", "forest", "castle"), place("어둠의 잠식", "domain", "ruin", "castle", "rock", "scarlet_dark"),
  ] },
  howlrstone13: { title: "붙잡아야 할 일 분", canon: "2.txt:208-241", places: [
    place("일 분의 결의", "court", "castle"), place("그림자의 분신", "domain", "ruin", "castle"),
    place("페르온의 영역 봉쇄", "domain", "castle", "ruin"), place("빛을 위한 빈틈", "throne", "castle", "forest", "rock", "scarlet_seal"),
  ] },
  howlrstone14: { title: "무의 원소와 시간의 힘", canon: "2.txt:247-307", places: [
    place("잠식되는 세계", "rift", "ruin", "astral"), place("라시온의 계약", "rift", "castle", "ruin"),
    place("자신의 본질", "domain", "astral"), place("하루의 에테르", "rift", "castle", "astral"),
    place("리엘의 무한한 시간선", "rift", "astral", "castle", "rock", "desknis"),
  ] },
  howlrstone15: { title: "끝이 아닌 재건", canon: "2.txt:307-323", places: [
    place("에델리오나의 재건", "village", "earth", "castle"), place("라일락의 무덤", "garden", "grass", "castle"),
    place("연합의 회의", "court", "castle"), place("워프 아일랜드", "shore", "grass", "castle", "water"),
  ] },
};

/** The approved second-season text covers these locations; later existing maps are optional combat records. */
const planet = (title: string, role: Place["role"], floor: TerrainMaterial, path: TerrainMaterial, border: TerrainMaterial, encounter: Record<number, string>, canon: string, training = false): ChapterStoryPlan => ({
  title, canon, training, places: Array.from({ length: 10 }, (_, i) => place(`${title} · ${i + 1}구역`, role, floor, path, border, encounter[i + 1])),
});
Object.assign(CHAPTER_STORY_PLAN, {
  dlcstargate: planet("스타게이트의 장미", "garden", "grass", "astral", "water", { 10: "littlestar" }, "8.txt:35-65"),
  dlcprisma: planet("프라이즈 프리즈마", "factory", "machine", "castle", "rock", { 10: "jade" }, "8.txt:92-147"),
  dlcreverse: planet("리버스 사이버", "city", "machine", "ruin", "rock", { 8: "reversecore" }, "8.txt:163-304"),
  dlcneocity: planet("네오시티", "city", "machine", "castle", "rock", { 4: "fabian" }, "8.txt:316-727"),
  dlcocean: planet("별빛 바다 · 전투기록 수련", "shore", "sand", "wood", "water", { 10: "jorm" }, "8.txt:145-162", true),
  dlcmech: planet("기계 도시 · 전투기록 수련", "factory", "machine", "castle", "rock", { 10: "vord" }, "8.txt:316-727", true),
  dlcswallow: planet("부유섬 · 전투기록 수련", "cliff", "grass", "castle", "water", { 10: "skoll" }, "8.txt:35-65", true),
  dlcopinicia: planet("성채 · 전투기록 수련", "throne", "castle", "astral", "rock", { 10: "surt" }, "8.txt:316-727", true),
  dlcnovel: planet("기록원 · 전투기록 수련", "observatory", "castle", "wood", "rock", { 10: "gram" }, "8.txt:316-727", true),
  dlcsernium: planet("세르니움행 준비 · 전투기록 수련", "court", "castle", "astral", "water", { 10: "nagr" }, "8.txt:8-25", true),
});

export function chapterPlace(chapter: string, sub: number): Place | undefined { return CHAPTER_STORY_PLAN[chapter]?.places[sub - 1]; }
export function chapterEncounter(chapter: string, sub: number): string | null { return chapterPlace(chapter, sub)?.boss ?? null; }
