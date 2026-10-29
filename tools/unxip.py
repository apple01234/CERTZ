#!/usr/bin/env python3
"""pbzx 스트림 디코더 → tar 추출.

Apple Xcode 의 .xip 은 xar 컨테이너이고, 그 안의 Content 는 pbzx 라는
커스텀 프레이밍 포맷이다. 구조:

    'pbzx' <8바이트 flags>
    반복:  <8바이트 big-endian chunk 길이> <XZ 스트림(chunk 길이 바이트)>

flags 는 보통 0x0100000000000000 (청크별 XZ). 각 청크는 독립 XZ 블록이라
이어붙이면 안 되고 청크 단위로 풀어야 한다.

사용:
  python3 tools/unxip.py content.tar out_dir
"""
import lzma
import os
import struct
import sys
import tarfile


def decode_pbzx(src: str, dst: str):
    """실측 구조 (Xcode_27.2 RC xip 의 pbzx):

         'pbzx'  <8바이트 전역 flags>
         반복:   <8바이트 원본(해제 후) 크기> <8바이트 압축 크기> <XZ 청크>

       첫 청크에서 offset 12 = 16,777,216(해제 크기), offset 20 = 7,478,316(압축 크기),
       offset 28 부터 XZ 매직(fd 37 7a 58 5a 00). 청크마다 길이 쌍이 앞에 붙는다.
    """
    with open(src, "rb") as f:
        if f.read(4) != b"pbzx":
            raise SystemExit("pbzx 매직 아님")
        f.read(8)  # 전역 flags

        total = chunks = 0
        with open(dst, "wb") as out:
            while True:
                pair = f.read(16)
                if len(pair) < 16:
                    break
                raw_len, comp_len = struct.unpack(">QQ", pair)
                if comp_len == 0 or comp_len > (1 << 34):
                    break
                data = f.read(comp_len)
                if len(data) < comp_len:
                    raise SystemExit(f"청크 절단: {len(data):,}/{comp_len:,}")
                chunks += 1
                # 일부 청크(관측: 79번째)는 압축되지 않은 원본이 그대로 온다.
                #  XZ 매직이 없으면 raw 로 취급한다.
                if data[:6] == b"\xfd7zXZ\x00":
                    try:
                        raw = lzma.decompress(data, format=lzma.FORMAT_XZ)
                    except lzma.LZMAError as e:
                        raise SystemExit(f"청크 {chunks} XZ 실패: {e}")
                else:
                    raw = data
                out.write(raw)
                total += len(raw)
        return total, chunks


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    src, dst = sys.argv[1], sys.argv[2]
    size, chunks = decode_pbzx(src, dst)
    print(f"pbzx 해제: {chunks}개 청크 → {size:,} bytes → {dst}")

    if not tarfile.is_tarfile(dst):
        print("결과가 tar 가 아님 — 원본 확인 필요")
        return 1
    os.makedirs(os.path.dirname(dst) or ".", exist_ok=True)
    with tarfile.open(dst) as tf:
        names = tf.getnames()
        print(f"tar 항목 {len(names)}개, 예: {names[:3]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
