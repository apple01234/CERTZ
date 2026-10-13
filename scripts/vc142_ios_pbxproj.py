#!/usr/bin/env python3
"""vc142 iOS pbxproj 패치 — ①GoogleService-Info.plist 리소스 등록 ②버전 변수(1.0.5/142)."""
import re

P = "ios/App/App.xcodeproj/project.pbxproj"
s = open(P).read()
orig = s

# 이미 등록돼 있으면 스킵 (멱등)
if "GoogleService-Info.plist" not in s:
    fid_ref = "5A1C0D142A0000010000000A"  # PBXFileReference id
    fid_bld = "5A1C0D142A0000020000000A"  # PBXBuildFile id

    # 1) PBXBuildFile 섹션 시작 직후 삽입
    marker = "/* Begin PBXBuildFile section */\n"
    s = s.replace(marker, marker + f"\t\t{fid_bld} /* GoogleService-Info.plist in Resources */ = {{isa = PBXBuildFile; fileRef = {fid_ref} /* GoogleService-Info.plist */; }};\n", 1)

    # 2) PBXFileReference 섹션 시작 직후 삽입
    marker = "/* Begin PBXFileReference section */\n"
    s = s.replace(marker, marker + f"\t\t{fid_ref} /* GoogleService-Info.plist */ = {{isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = text.plist.xml; path = GoogleService-Info.plist; sourceTree = \"<group>\"; }};\n", 1)

    # 3) App 그룹(children)에 추가 — Info.plist가 속한 그룹과 동일하게
    m = re.search(r"([0-9A-F]{24} /\* App \*/ = \{[^}]*?children = \(\n)((?:.*?\n)*?)(\t\t\t\);)", s)
    if not m:
        raise SystemExit("App group not found")
    s = s[:m.end(1)] + f"\t\t\t\t{fid_ref} /* GoogleService-Info.plist */,\n" + s[m.end(1):]

    # 4) Resources 빌드 페이즈 files 목록에 추가
    marker = "\t\t504EC3021FED79650016851F /* Resources */ = {\n\t\t\tisa = PBXResourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n"
    s = s.replace(marker, marker + f"\t\t\t\t{fid_bld} /* GoogleService-Info.plist in Resources */,\n", 1)
    print("GoogleService-Info.plist registered in pbxproj")
else:
    print("GoogleService-Info.plist already registered")

# 5) 버전 변수 — MARKETING_VERSION 1.0 → 1.0.5, CURRENT_PROJECT_VERSION 1 → 142
n1 = s.count("MARKETING_VERSION = 1.0;")
s = s.replace("MARKETING_VERSION = 1.0;", "MARKETING_VERSION = 1.0.5;")
n2 = s.count("CURRENT_PROJECT_VERSION = 1;")
s = s.replace("CURRENT_PROJECT_VERSION = 1;", "CURRENT_PROJECT_VERSION = 142;")
print(f"MARKETING_VERSION patched x{n1}, CURRENT_PROJECT_VERSION patched x{n2}")

if s != orig:
    open(P, "w").write(s)
    print("pbxproj written")
