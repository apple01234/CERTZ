#!/usr/bin/env python3
"""Scan an audio file for the healthy (fast-decodable) prefix.
Slow-decode zones = broken/corrupt stream tail (loader.to conversion glitch).
Usage: python3 scan_health.py <file> [chunk=300] [probe=30]
Writes result JSON to stdout.
"""
import json, os, subprocess, sys, time

def probe_speed(path, ss, t):
    start = time.time()
    r = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-ss", str(ss), "-t", str(t), "-i", path, "-f", "null", "/dev/null"],
        capture_output=True, timeout=60)
    return time.time() - start, r.returncode

def main():
    path = sys.argv[1]
    chunk = int(sys.argv[2]) if len(sys.argv) > 2 else 300
    probe = int(sys.argv[3]) if len(sys.argv) > 3 else 30
    # total duration
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                       capture_output=True, text=True)
    total = float(r.stdout.strip())
    print(f"file={os.path.basename(path)} total={total:.0f}s", flush=True)
    healthy_end = 0.0
    times = []
    for ss in range(0, int(total) - probe, chunk):
        wall, rc = probe_speed(path, ss, probe)
        times.append((ss, round(wall, 2)))
        print(f"  ss={ss:>5} wall={wall:.2f}s rc={rc}", flush=True)
        if wall > 6.0:  # fast baseline <1s; 6x margin = corrupt zone
            break
        healthy_end = ss + chunk
    result = {"file": path, "total": total, "healthy_end": min(healthy_end, total), "probes": times}
    print("RESULT " + json.dumps(result))

if __name__ == "__main__":
    main()
