#!/usr/bin/env node
/**
 * vc146 — electron.exe에 SERTZ 아이콘+버전 메타데이터 주입 (resedit — 순수 JS, wine 불필요)
 *  Linux에서 electron-builder의 rcedit(wine 의존)을 대체: electronDist 패치 방식
 */
const fs = require("node:fs");
const { NtExecutable, NtExecutableResource, Data, Resource } = require("resedit");

const SRC = "/home/z/.cache/electron-patched/electron-dist/electron.exe";
const ICO = "/home/z/my-project/electron/dist/.icon-ico/icon.ico";

const exe = NtExecutable.from(fs.readFileSync(SRC));
const res = NtExecutableResource.from(exe);

// 1) 아이콘 교체 (언어 1033=en-US, 그룹 ID 1)
const iconFile = Data.IconFile.from(fs.readFileSync(ICO));
const icons = iconFile.icons.map((i) => i.data);
if (!icons.length) throw new Error("ico 파싱 실패 — 아이콘 0개");
Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, 1033, icons);

// 2) 버전 정보 (VS_VERSIONINFO) — 기존 VersionInfo 제거 후 신규 생성
const lang = 1033, codepage = 1200;
const entries = res.entries.filter((e) => e.type !== 16 /* VersionInfo */);
const vi = Resource.VersionInfo.createEmpty();
vi.fixedInfo.fileVersionMS = 1 << 16;
vi.fixedInfo.fileVersionLS = 6 << 16; // FileVersion 1.0.6.0
vi.fixedInfo.productVersionMS = 1 << 16;
vi.fixedInfo.productVersionLS = 6 << 16;
const strings = {
  ProductName: "SERTZ",
  FileDescription: "SERTZ — 바다의 수호자: 아뜰란티스 (vc146 정식)",
  ProductVersion: "1.0.6",
  FileVersion: "1.0.6.0",
  CompanyName: "SERTZ",
  LegalCopyright: "Copyright (c) 2026 SERTZ",
  OriginalFilename: "SERTZ.exe",
  InternalName: "SERTZ",
};
for (const [k, v] of Object.entries(strings)) vi.setStringValue({ lang, codepage }, k, v);
vi.outputToResourceEntries(entries);
res.entries = entries;

res.outputResource(exe);
fs.writeFileSync(SRC, Buffer.from(exe.generate({ recomputeCheckSum: true })));
console.log("patched OK:", SRC, fs.statSync(SRC).size, "bytes");
