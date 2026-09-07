# -*- coding: utf-8 -*-
"""SERTZ 웹 성능 감사 보고서 — 실측 데이터 차트 2종 생성 (DM-1 팔레트 파생 색상)"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.font_manager as fm
import os, glob

# 한글 폰트 등록 (WenQuanYi Zen Hei — Hangul 커버, fc-list :lang=ko 확인됨)
for pat in ("/usr/share/fonts/truetype/wqy/*.ttc", "/usr/share/fonts/truetype/wqy/*.ttf"):
    for f in glob.glob(pat):
        try:
            fm.fontManager.addfont(f)
        except Exception:
            pass
fm.fontManager.addfont("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")

import matplotlib.pyplot as plt
plt.rcParams["font.sans-serif"] = ["WenQuanYi Zen Hei", "DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False

ACCENT = "#1B6B7A"      # DM-1 table accent (밝은 #37DCF2 대신 페이지용 어두운 톤)
ACCENT_SOFT = "#5B98A5"
SURFACE = "#EDF3F5"
INK = "#16232E"
GRID = "#C8DDE2"

OUT = "/home/z/my-project/scripts/_perf_charts"
os.makedirs(OUT, exist_ok=True)

# ── Fig 1: 현재 주요 정적 자산 용량 (실측) ─────────────────────────────
fig, ax = plt.subplots(figsize=(7.6, 4.0), dpi=150, constrained_layout=True)
cats = ["웹폰트 (woff2)", "JS 청크 (Turbopack)", "PNG 이미지", "오디오 (OGG)"]
vals = [1.6, 2.7, 3.6, 129.0]
notes = ["4종 (Galmuri)", "Phaser 단일 청크 1,827KB 포함", "스프라이트·이펙트", "79개·BootScene 전량 사전 로드"]
bars = ax.barh(cats, vals, color=[ACCENT_SOFT, ACCENT_SOFT, ACCENT_SOFT, ACCENT], height=0.58)
ax.set_xscale("log")
ax.set_xlim(0.5, 4000)
ax.set_xlabel("용량 (MB, 로그 스케일)", fontsize=9, color=INK)
for b, v, n in zip(bars, vals, notes):
    ax.text(v * 1.18, b.get_y() + b.get_height() / 2, f"{v:g} MB — {n}",
            va="center", fontsize=7.8, color=INK)
ax.set_title("SERTZ 정적 자산 용량 구성 (실측, 2026-09-07)", fontsize=11, color=INK, pad=10)
ax.tick_params(colors=INK, labelsize=9)
ax.spines[["top", "right"]].set_visible(False)
ax.spines[["left", "bottom"]].set_color(GRID)
ax.xaxis.grid(True, color=GRID, linewidth=0.6, alpha=0.6)
ax.set_axisbelow(True)
fig.savefig(f"{OUT}/fig1_assets.png", facecolor="white")
plt.close(fig)

# ── Fig 2: 오디오 비트레이트 재인코딩 시 예상 용량 ────────────────────
fig, ax = plt.subplots(figsize=(7.6, 4.0), dpi=150, constrained_layout=True)
labels = ["현재\n(129MB 실측)", "128 kbps\n재인코딩", "96 kbps\n재인코딩", "64 kbps\n재인코딩"]
sizes = [129.0, 86.0, 64.5, 43.0]
colors = [ACCENT, ACCENT_SOFT, "#8FB6BE", "#B9D0D5"]
bars = ax.bar(labels, sizes, color=colors, width=0.56)
for b, v in zip(bars, sizes):
    ax.text(b.get_x() + b.get_width() / 2, v + 3.5, f"{v:g} MB",
            ha="center", fontsize=9.5, color=INK, fontweight="bold")
    if v != 129.0:
        cut = (1 - v / 129.0) * 100
        ax.text(b.get_x() + b.get_width() / 2, v / 2, f"-{cut:.0f}%",
                ha="center", va="center", fontsize=9, color="white", fontweight="bold")
ax.set_ylabel("오디오 총 용량 (MB)", fontsize=9, color=INK)
ax.set_ylim(0, 150)
ax.set_title("BGM/효과음 재인코딩 시 예상 절감 (ffmpeg 제공 — 예상치)", fontsize=11, color=INK, pad=10)
ax.tick_params(colors=INK, labelsize=9)
ax.spines[["top", "right"]].set_visible(False)
ax.spines[["left", "bottom"]].set_color(GRID)
ax.yaxis.grid(True, color=GRID, linewidth=0.6, alpha=0.6)
ax.set_axisbelow(True)
fig.savefig(f"{OUT}/fig2_audio.png", facecolor="white")
plt.close(fig)

print("OK:", os.listdir(OUT))
