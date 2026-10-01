# -*- coding: utf-8 -*-
"""docx 후처리: (1) 빈 pgNumType 제거 (2) 섹션 순서 기반 푸터 PAGE 필드에 ROMAN/arabic 스위치 부여
toc.md § Page Number API / WPS 호환 규칙 구현."""
import re, shutil, sys, zipfile

DOCX = sys.argv[1] if len(sys.argv) > 1 else "/home/z/my-project/download/SERTZ_웹성능_최적화_감사보고서.docx"
TMP = DOCX + ".tmp"

zin = zipfile.ZipFile(DOCX, "r")
names = zin.namelist()
docxml = zin.read("word/document.xml").decode("utf-8")
rels = zin.read("word/_rels/document.xml.rels").decode("utf-8")

# 1) 빈 pgNumType 제거 (표지 섹션)
docxml, n_strip = re.subn(r"<w:pgNumType/>", "", docxml)

# 2) sectPr 순서대로 footerReference r:id 추출 (default 타입만)
sect_blocks = re.findall(r"<w:sectPr[ >][\s\S]*?</w:sectPr>", docxml)
footer_rids = []
for blk in sect_blocks:
    m = re.search(r'<w:footerReference w:type="default" r:id="(rId\d+)"', blk)
    footer_rids.append(m.group(1) if m else None)

# 3) rId → 대상 파일
rid2target = dict(re.findall(r'<Relationship Id="(rId\d+)"[^>]*Target="([^"]+)"', rels))

def patch_footer(fname, fmt):
    xml = zin.read("word/" + fname).decode("utf-8")
    xml2, n = re.subn(
        r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
        r"\1 PAGE \\* " + fmt + r" \\* MERGEFORMAT \2",
        xml)
    return xml2, n

with_targets = [r for r in footer_rids if r]
plan = []
if len(with_targets) >= 1:
    plan.append((rid2target.get(with_targets[0], "").lstrip("/"), "ROMAN"))
if len(with_targets) >= 2:
    plan.append((rid2target.get(with_targets[1], "").lstrip("/"), "arabic"))

patched = {}
for fname, fmt in plan:
    if not fname:
        continue
    xml2, n = patch_footer(fname, fmt)
    patched["word/" + fname] = xml2
    print(f"  footer {fname} -> {fmt} ({n} field patched)")

zout = zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED)
for item in names:
    if item == "word/document.xml":
        zout.writestr(item, docxml)
    elif item in patched:
        zout.writestr(item, patched[item])
    else:
        zout.writestr(item, zin.read(item))
zout.close()
zin.close()
shutil.move(TMP, DOCX)
print(f"OK pgNumType stripped={n_strip}, footers patched={len(patched)}")
