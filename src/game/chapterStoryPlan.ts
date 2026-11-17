/** Location/encounter bindings from the eight approved documents, in their precedence order.
 * A place without an encounter is deliberately not given an invented story boss. */
export type TerrainMaterial = "grass" | "sand" | "rock" | "water" | "wood" | "castle" | "earth" | "snow" | "machine" | "ruin" | "astral" | "volcano" | "forest";
export type Place = {
  title: string; floor: TerrainMaterial; path: TerrainMaterial; border: TerrainMaterial;
  role: "cliff" | "village" | "ruin" | "dungeon" | "inn" | "court" | "observatory" | "harbor" | "deck" | "shore" | "sanctuary" | "road" | "camp" | "tunnel" | "throne" | "domain" | "rift" | "garden" | "factory" | "city" | "rail" | "snowfield";
  boss?: string;
};
export type ChapterStoryPlan = { title: string; canon: string; places: Place[]; training?: boolean };
const place = (title: string, role: Place["role"], floor: TerrainMaterial, path: TerrainMaterial = floor, border: TerrainMaterial = "rock", boss?: string): Place => ({ title, role, floor, path, border, ...(boss ? { boss } : {}) });

export const CHAPTER_STORY_PLAN: Record<string, ChapterStoryPlan> = {
  lilacworld1: { title: "절벽의 약속", canon: "1.txt:4-34", places: [
    place("라일락과 만난 절벽", "cliff", "grass", "earth"), place("마을의 수련터", "village", "grass", "earth"),
    place("에델리오나 성의 뒷문", "court", "castle", "earth", "castle"), place("검이 잠든 지하 감옥", "dungeon", "ruin", "castle", "castle"),
  ] },
  lilacworld2: { title: "떠나야 할 이유", canon: "1.txt:62-174", places: [
    place("시스터즈의 아지트와 서쪽 길", "inn", "wood", "earth", "castle"), place("피난 골목", "ruin", "ruin", "earth", "ruin"),
    place("디오와 사념체", "court", "ruin", "castle", "ruin", "dio"), place("습격이 끝난 마을", "village", "earth", "castle", "ruin"),
  ] },
  lilacworld3: { title: "칼리야의 수련", canon: "2.txt:35-45", places: [
    place("칼리야로 가는 길", "road", "grass", "earth", "forest"), place("도깨비들의 언덕", "cliff", "forest", "earth"),
    place("리엘의 주막", "inn", "wood", "earth", "castle"), place("원소 순환 수련장", "court", "earth", "castle"), place("에벤트로 향하는 길", "road", "grass", "earth", "forest"),
  ] },
  lilacworld4: { title: "벨리카와 에벤트", canon: "2.txt:46-61", places: [
    place("우편배달 길", "road", "grass", "earth", "forest"), place("대공립천문대", "observatory", "castle", "astral", "castle"),
    place("에벤트 외곽", "village", "grass", "castle", "forest"), place("왕국의 수련뜰", "court", "castle", "earth", "castle"),
  ] },
  lilacworld5: { title: "남부의 해전", canon: "2.txt:59-71", places: [
    place("남부 방어선", "camp", "grass", "earth"), place("에스테반 항만", "harbor", "sand", "wood", "water"),
    place("전함의 갑판", "deck", "wood", "wood", "water"), place("해롤드의 크라켄", "shore", "sand", "wood", "water", "harold"),
  ] },
  lilacworld6: { title: "루시의 상처", canon: "2.txt:90-103", places: [
    place("생명의 영역 입구", "garden", "forest", "grass", "forest"), place("숲의 치료소", "sanctuary", "grass", "castle", "forest"),
    place("다크니스의 상흔", "sanctuary", "ruin", "forest", "forest"), place("보석의 힘 흡수", "court", "castle", "forest", "forest"),
  ] },
  lilacworld7: { title: "이동석과 고대의 재앙", canon: "2.txt:73-125", places: [
    place("칼리야 전선", "camp", "earth", "castle"), place("군단장의 전초", "ruin", "ruin", "earth"),
    place("저주와 흑마법의 진지", "court", "ruin", "castle", "rock", "verodin"),
    place("이동석 설치 지점", "observatory", "castle", "earth"), place("라시온과의 결투", "court", "earth", "castle", "rock", "rasion"),
  ] },
  lilacworld8: { title: "잃어버린 라일락의 기억", canon: "2.txt:129-143", places: [
    place("에벤트 성문", "court", "castle"), place("두 전사의 전장", "court", "earth", "castle"),
    place("무너진 유적", "ruin", "ruin", "earth"), place("아리와 페르온의 격전", "court", "castle", "castle", "rock", "feron"),
    place("기억을 돌려주는 펜던트", "garden", "grass", "castle", "forest"),
  ] },
  lilacworld9: { title: "연합의 재집결", canon: "2.txt:144-156", places: [
    place("연합 집결지", "camp", "grass", "earth", "forest"), place("부상자 치료 천막", "sanctuary", "grass", "wood", "forest"),
    place("성채 결계 외곽", "ruin", "ruin", "castle", "ruin"), place("반란군이 연 돌입로", "road", "earth", "castle", "ruin"),
  ] },
  lilacworld10: { title: "시스터즈의 비밀 통로", canon: "2.txt:158-162", places: [
    place("어둠의 성채 외벽", "ruin", "ruin", "castle"), place("군단장들이 지키는 정면 입구", "court", "castle", "ruin", "rock"),
    place("지하의 미로", "tunnel", "ruin", "castle", "castle"), place("스칼렛의 함정", "tunnel", "castle", "ruin", "ruin"), place("시스터즈의 방어선", "tunnel", "ruin", "castle", "castle"),
  ] },
  lilacworld11: { title: "피의 영역", canon: "2.txt:162-166", places: [
    place("왕좌의 전실", "throne", "castle"), place("원혈의 의식", "domain", "castle", "ruin"),
    place("근접 돌파", "court", "castle"), place("스칼렛의 피의 영역", "throne", "castle", "castle", "rock", "scarlet_blood"),
  ] },
  lilacworld12: { title: "원소가 반응하는 순간", canon: "2.txt:167-205", places: [
    place("중첩된 영역", "domain", "astral", "castle"), place("원소의 반응", "domain", "castle", "astral"),
    place("마지막 자연의 힘", "garden", "forest", "castle"), place("어둠의 잠식", "domain", "ruin", "castle", "rock", "scarlet_dark"),
  ] },
  lilacworld13: { title: "붙잡아야 할 일 분", canon: "2.txt:208-241", places: [
    place("일 분의 결의", "court", "castle"), place("그림자의 분신", "domain", "ruin", "castle"),
    place("페르온의 영역 봉쇄", "domain", "castle", "ruin"), place("빛을 위한 빈틈", "throne", "castle", "forest", "rock", "scarlet_seal"),
  ] },
  lilacworld14: { title: "무의 원소와 시간의 힘", canon: "2.txt:247-307", places: [
    place("잠식되는 세계", "rift", "ruin", "astral"), place("라시온의 계약", "rift", "castle", "ruin"),
    place("자신의 본질", "domain", "astral"), place("하루의 에테르", "rift", "castle", "astral"),
    place("리엘의 무한한 시간선", "rift", "astral", "castle", "rock", "desknis"),
  ] },
  lilacworld15: { title: "끝이 아닌 재건", canon: "2.txt:307-323", places: [
    place("에델리오나의 재건", "village", "earth", "castle", "forest"), place("라일락의 무덤", "garden", "grass", "castle", "forest"),
    place("하루가 돌아온 집", "inn", "wood"), place("워프 아일랜드", "shore", "grass", "castle", "water"),
  ] },
};

type Site = [Place["role"], TerrainMaterial, TerrainMaterial, TerrainMaterial];
const planet = (title: string, canon: string, sites: Site[], encounter: Record<number, string>, training = false): ChapterStoryPlan => ({
  title, canon, training, places: Array.from({ length: 10 }, (_, i) => place(`${title} · ${i + 1}구역`, ...sites[i % sites.length], encounter[i + 1])),
});
Object.assign(CHAPTER_STORY_PLAN, {
  dlcstargate: planet("스타게이트의 장미", "8.txt:8-76", [
    ["shore", "grass", "castle", "water"], ["observatory", "castle", "astral", "water"],
    ["garden", "forest", "grass", "forest"], ["sanctuary", "grass", "astral", "forest"],
    ["rift", "astral", "ruin", "astral"], ["garden", "forest", "astral", "astral"],
    ["rift", "castle", "astral", "astral"], ["ruin", "ruin", "astral", "astral"],
    ["observatory", "astral", "castle", "astral"], ["domain", "astral", "castle", "astral"],
  ], { 10: "littlestar" }),
  dlcprisma: planet("프라이즈 프리즈마", "8.txt:92-147", [
    ["city", "machine", "castle", "machine"], ["factory", "machine", "castle", "machine"],
    ["observatory", "machine", "astral", "machine"], ["inn", "wood", "castle", "castle"],
    ["tunnel", "machine", "astral", "machine"], ["factory", "machine", "ruin", "machine"],
    ["rail", "machine", "castle", "machine"], ["sanctuary", "forest", "machine", "machine"],
    ["observatory", "machine", "astral", "water"], ["domain", "machine", "astral", "machine"],
  ], { 10: "jade" }),
  dlcreverse: planet("리버스 사이버", "8.txt:163-304", [
    ["city", "machine", "ruin", "machine"], ["tunnel", "ruin", "machine", "ruin"],
    ["rail", "ruin", "machine", "machine"], ["factory", "machine", "ruin", "machine"],
    ["inn", "machine", "ruin", "machine"], ["observatory", "machine", "astral", "machine"],
    ["city", "ruin", "machine", "ruin"], ["domain", "machine", "ruin", "machine"],
    ["rail", "machine", "ruin", "ruin"], ["garden", "grass", "ruin", "machine"],
  ], { 8: "reversecore" }),
  dlcneocity: planet("네오시티", "8.txt:316-727", [
    ["city", "machine", "castle", "water"], ["court", "castle", "machine", "machine"],
    ["observatory", "castle", "astral", "castle"], ["court", "castle", "earth", "castle"],
    ["throne", "machine", "castle", "machine"], ["rift", "ruin", "machine", "astral"],
    ["city", "castle", "astral", "water"], ["city", "wood", "castle", "machine"],
    ["dungeon", "ruin", "machine", "castle"], ["inn", "wood", "astral", "castle"],
  ], { 4: "fabian" }),
  dlcocean: planet("별빛 바다 · 전투기록 수련", "8.txt:145-162", [["shore", "sand", "wood", "water"], ["rift", "astral", "sand", "water"], ["harbor", "sand", "wood", "water"]], { 10: "unionserpent" }, true),
  dlcmech: planet("기계 도시 · 전투기록 수련", "8.txt:316-727", [["ruin", "machine", "ruin", "machine"], ["rail", "ruin", "machine", "machine"], ["factory", "machine", "castle", "machine"]], { 10: "riftwarden" }, true),
  dlcswallow: planet("부유섬 · 전투기록 수련", "8.txt:35-65", [["deck", "wood", "machine", "astral"], ["rift", "castle", "machine", "astral"]], { 10: "twinwolf" }, true),
  dlcopinicia: planet("성채 · 전투기록 수련", "8.txt:316-727", [["court", "castle", "astral", "castle"], ["city", "castle", "earth", "castle"], ["throne", "castle", "wood", "castle"]], { 10: "flamegiant" }, true),
  dlcnovel: planet("기록원 · 전투기록 수련", "8.txt:316-727", [["garden", "forest", "grass", "forest"], ["observatory", "castle", "wood", "forest"]], { 10: "warden" }, true),
  dlcsernium: planet("세르니움행 준비 · 전투기록 수련", "8.txt:8-25", [["court", "castle", "astral", "water"], ["observatory", "astral", "castle", "astral"], ["city", "castle", "astral", "water"]], { 10: "angelknight" }, true),
  snorika: { title: "눈의 왕국 스노리카", canon: "6.txt:7-91", places: [
    place("천문대의 수상한 책", "observatory", "castle", "astral", "castle"),
    place("눈사람을 만드는 아이", "snowfield", "snow", "earth", "snow"),
    place("얼어붙은 심장의 사명", "sanctuary", "snow", "castle", "snow"),
    place("아트필드와 번개의 장막", "rift", "snow", "astral", "snow"),
    place("즉위식의 얼음 검", "throne", "snow", "castle", "snow", "snorikaking"),
    place("변하는 것과 변하지 않는 것", "snowfield", "snow", "castle", "snow"),
  ] },
});

export function chapterPlace(chapter: string, sub: number): Place | undefined { return CHAPTER_STORY_PLAN[chapter]?.places[sub - 1]; }
export function chapterEncounter(chapter: string, sub: number): string | null { return chapterPlace(chapter, sub)?.boss ?? null; }

export function storyPlaceOf(stage: string) {
  const match = /^(lilacworld\d+)x(\d+)$/.exec(stage) ?? /^(dlc[a-z]+|snorika)(\d+)$/.exec(stage);
  if (!match) return undefined;
  const chapter = match[1];
  const sub = Number(match[2]);
  const location = chapterPlace(chapter, sub);
  return location && { chapter, sub, place: location };
}
