#!/usr/bin/env python3
"""
Social Network — Saturn Multi-Angle Visual Verification Renderer.
Renders front, back, top, bottom, closeup, and normal viewing distance using Playwright + Three.js.
"""

import http.server
import socketserver
import threading
import time
import os
import sys
from playwright.sync_api import sync_playwright

PORT = 8996
DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(DIR)
OUTPUT_DIR = os.path.join(DIR, ".tmp", "screenshots_final")
os.makedirs(OUTPUT_DIR, exist_ok=True)

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

class QuietServer(socketserver.TCPServer):
    allow_reuse_address = True

server = QuietServer(("127.0.0.1", PORT), QuietHandler)
server_thread = threading.Thread(target=server.serve_forever, daemon=True)
server_thread.start()

print(f"Rendering multi-angle validation views for final/saturn-final.glb...")

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--use-gl=angle", "--use-angle=swiftshader", "--no-sandbox"]
        )
        page = browser.new_page(viewport={"width": 1024, "height": 768})
        page.goto(f"http://127.0.0.1:{PORT}/3d/.tmp/viewer/index.html")
        page.evaluate("window.setupScene()")
        
        page.evaluate('window.loadModel("/final/saturn-final.glb")')
        page.wait_for_function('document.getElementById("status").innerText === "ready"', timeout=30000)
        
        views = ["front", "back", "top", "bottom", "closeup", "normal"]
        for view in views:
            page.evaluate(f'window.setCameraView("{view}")')
            time.sleep(0.3)
            out_path = os.path.join(OUTPUT_DIR, f"saturn_{view}.png")
            page.screenshot(path=out_path)
            print(f"   ✓ Rendered {view} view -> {out_path}")

        browser.close()
    print("Multi-angle visual validation complete!")
finally:
    server.shutdown()

