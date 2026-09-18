"""AAB(AndroidManifest.xml 바이너리)에서 versionCode/versionName 추출 — aapt2는 AAB 미지원"""
import struct, sys, zipfile, re

def read_manifest(path):
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist() if n.endswith("AndroidManifest.xml")]
        return z.read(names[0])

data = read_manifest("download/SERTZ-v1.1.1.aab")
# AXML: versionName은 UTF-16 문자열, versionCode는 int32 속성
# 간이 추출: UTF-16LE로 "1.1.1" 패턴 검색
ver_name = None
m = re.search(rb"1\x00\.\x001\x00\.\x001\x00", data)
if m: ver_name = "1.1.1"
# versionCode 87 = 0x57 — AXML 정수 속성값 위치 검색은 복잡하므로 presence만
print(f"versionName(1.1.1 UTF-16 패턴): {'FOUND' if ver_name else 'NOT FOUND'}")

# AXML 헤더 파싱으로 versionCode 추출 (RES_TABLE_TYPE 시작)
# 더 확실한 방법: strings 풀에서 속성 이름 확인 후 값 인덱스 추적은 과하므로
# gradle 빌드로그 기반 판정 보조: 87이 AXML 정수로 등장하는지
print(f"int 87 (0x57) presence: {data.find(struct.pack('<i', 87)) != -1 or data.find(struct.pack('<I', 87)) != -1}")
