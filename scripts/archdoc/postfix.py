#!/usr/bin/env python3
"""postfix.py — docx 후처리: 푸터 PAGE 필드 형식 스위치(Roman/arabic) 패치 + 빈 pgNumType 제거"""
import re, shutil, sys, zipfile, os
import xml.etree.ElementTree as ET

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}

def main(path):
    tmp = path + ".tmp"
    shutil.copy(path, tmp)

    with zipfile.ZipFile(tmp, "r") as z:
        names = z.namelist()
        doc_xml = z.read("word/document.xml").decode("utf-8")
        rels_xml = z.read("word/_rels/document.xml.rels").decode("utf-8")
        contents = {n: z.read(n) for n in names}

    # 1) 빈 pgNumType 제거(표지 섹션)
    doc_xml = doc_xml.replace("<w:pgNumType/>", "")

    # 2) 섹션 순서대로 footerReference rId 추출
    sect_footer_rids = []
    for sect in re.findall(r"<w:sectPr[\s\S]*?</w:sectPr>|<w:sectPr[^>]*/>", doc_xml):
        m = re.search(r'<w:footerReference[^>]*w:type="default"[^>]*r:id="([^"]+)"', sect)
        sect_footer_rids.append(m.group(1) if m else None)
    # 섹션 1=표지(없음), 2=목차(ROMAN), 3=본문(arabic) 기대
    print("section footer rIds:", sect_footer_rids)

    rid_to_target = {}
    rels_root = ET.fromstring(rels_xml)
    for rel in rels_root.findall("{%s}Relationship" % NS["rel"]):
        rid_to_target[rel.get("Id")] = rel.get("Target")

    def patch_footer(target, fmt):
        name = "word/" + target
        xml = contents[name].decode("utf-8")
        xml2 = re.sub(
            r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
            r"\1 PAGE \\* %s \\* MERGEFORMAT \2" % fmt,
            xml)
        contents[name] = xml2.encode("utf-8")
        print("patched", name, "->", fmt)

    # 섹션 2(목차) → ROMAN, 섹션 3(본문) → arabic
    if len(sect_footer_rids) >= 3:
        if sect_footer_rids[1] and sect_footer_rids[1] in rid_to_target:
            patch_footer(rid_to_target[sect_footer_rids[1]], "ROMAN")
        if sect_footer_rids[2] and sect_footer_rids[2] in rid_to_target:
            patch_footer(rid_to_target[sect_footer_rids[2]], "arabic")
    else:
        print("WARN: expected 3 sections, got", len(sect_footer_rids))

    contents["word/document.xml"] = doc_xml.encode("utf-8")

    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for n, data in contents.items():
            z.writestr(n, data)
    os.remove(tmp)
    print("done:", path)

if __name__ == "__main__":
    main(sys.argv[1])
