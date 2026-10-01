#!/usr/bin/env python3
"""이중 포크 데몬 스포너 — PPID 1로 완전 분리해 세션 정리에서 탈출 시도"""
import os, sys, time

def daemonize():
    pid = os.fork()
    if pid > 0: os._exit(0)          # 부모 1차 종료
    os.setsid()                       # 새 세션
    pid = os.fork()
    if pid > 0: os._exit(0)          # 부모 2차 종료 — 자식은 PPID 1
    os.chdir("/home/z/my-project")
    devnull = os.open(os.devnull, os.O_RDWR)
    for fd in (0, 1, 2):
        os.dup2(devnull, fd)

cmd = sys.argv[1:]
daemonize()
# 자식(데몬) — exec
os.execvp(cmd[0], cmd)
