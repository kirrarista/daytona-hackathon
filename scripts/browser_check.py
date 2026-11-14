"""Real-Chromium desktop/mobile acceptance and offline demo recording."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = ROOT / "artifacts"
PORT = 8765
BASE = f"http://127.0.0.1:{PORT}"


def wait_for_server() -> None:
    for _ in range(100):
        try:
            with urllib.request.urlopen(BASE + "/api/health", timeout=1) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.1)
    raise RuntimeError("Uvicorn did not become healthy")


def run() -> None:
    ARTIFACTS.mkdir(exist_ok=True)
    environment = dict(os.environ)
    for key in ("DAYTONA_API_KEY", "NOSANA_URL", "NOSANA_API_KEY"):
        environment.pop(key, None)
    environment["PLAYWRIGHT_BROWSERS_PATH"] = str(ROOT / ".playwright")
    log_path = ARTIFACTS / "browser-server.log"
    with log_path.open("w") as log:
        server = subprocess.Popen([str(ROOT / ".venv/bin/uvicorn"), "roomledger.app:app", "--host", "127.0.0.1", "--port", str(PORT)],
                                  cwd=ROOT, env=environment, stdout=log, stderr=subprocess.STDOUT)
        try:
            wait_for_server()
            with sync_playwright() as playwright:
                chromium = shutil.which("chromium-browser") or shutil.which("chromium") or shutil.which("google-chrome")
                launch = {"headless": True, "args": ["--no-sandbox"]}
                if chromium:
                    launch["executable_path"] = chromium
                browser = playwright.chromium.launch(**launch)
                context = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1,
                                               record_video_dir=str(ARTIFACTS / "video"), record_video_size={"width": 1440, "height": 900},
                                               accept_downloads=True)
                page = context.new_page()
                errors, external = [], []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.on("request", lambda request: external.append(request.url) if request.url.startswith(("http://", "https://")) and not request.url.startswith(BASE) else None)
                page.goto(BASE, wait_until="networkidle")
                page.screenshot(path=str(ARTIFACTS / "01-welcome.png"), full_page=True)
                page.locator("#sample-button").click()
                page.locator("#run-toast").filter(has_text="6 rooms").wait_for(state="visible", timeout=90000)
                page.wait_for_timeout(1200)
                assert page.locator("#fleet > *").count() == 6, "Fleet must show six independent workers"
                assert page.locator("#room-list > *").count() == 6, "Six room records must be available"
                assert page.locator("#photo-canvas svg").count() == 1, "Active room needs an SVG evidence overlay"
                assert page.locator("#fleet .tile-progress").count() == 6, "Every fleet tile needs visible progress"
                assert page.locator("#item-count").inner_text().strip().startswith("24"), "Expected 24 verified sample items"
                assert "destroyed" not in page.locator("#fleet").inner_text().lower(), "Local run cannot claim destroyed Daytona sandboxes"
                assert "local" in page.locator("#run-toast").inner_text().lower(), "Offline summary must identify local execution"
                page.screenshot(path=str(ARTIFACTS / "02-inventory-desktop.png"), full_page=True)

                page.locator("#room-list").get_by_text("Living Room West", exact=False).first.click()
                television = page.locator("#item-legend").get_by_text("65-inch television", exact=False).first
                television.click()
                page.locator("#edit-item-button").click()
                dialog = page.locator("#item-dialog")
                dialog.wait_for(state="visible")
                form = page.locator("#item-form")
                label = form.locator('input[name="label"], input[type="text"]').first
                original_label = label.input_value()
                label.fill(original_label + " — receipt checked")
                price = form.locator('input[name="price"], input[name="replacement_usd"], input[type="number"], #edit-price').first
                price.fill("950")
                page.locator("#edit-condition").select_option("fair")
                checkbox = form.locator('input[type="checkbox"]').first
                checkbox.check()
                form.locator('button[type="submit"], button:has-text("Save")').first.click()
                page.wait_for_timeout(300)
                assert "receipt checked" in page.locator("#item-legend").inner_text(), "Edited item must stay in current inventory"
                assert "fair" in page.locator("#inspector").inner_text().lower(), "Condition edit must update evidence"

                page.locator("#mode-quake").click()
                page.locator("#readiness-score").wait_for(state="visible")
                page.locator("#language-toggle").click()
                page.wait_for_timeout(300)
                body_text = page.locator("body").inner_text()
                assert any(word in body_text for word in ("転倒", "家具", "耐震", "買い物")), "Japanese quake copy missing"
                page.locator("#dismiss-toast").click()
                page.evaluate("document.activeElement?.blur?.(); document.querySelector('.skip-link').hidden = true")
                page.screenshot(path=str(ARTIFACTS / "03-quake-japanese.png"), full_page=True)
                page.locator("#language-toggle").click()

                with page.expect_download() as download_info:
                    page.locator("#csv-button").click()
                download = download_info.value
                assert download.suggested_filename == "roomledger-inventory.csv"
                csv_path = ARTIFACTS / "roomledger-inventory.csv"
                download.save_as(csv_path)
                csv_text = csv_path.read_text(encoding="utf-8-sig")
                assert "receipt checked" in csv_text and "fingerprint" in csv_text.lower(), "CSV must include current edits and evidence"

                with page.expect_popup() as popup_info:
                    page.locator("#report-button").click()
                report = popup_info.value
                report.wait_for_load_state("domcontentloaded")
                report_text = report.locator("body").inner_text()
                assert "AI estimates — verify with receipts. Not an insurance appraisal." in report_text
                assert "receipt checked" in report_text and "Photo evidence fingerprint" in report_text and "UTC processing timestamp" in report_text
                assert report.locator("img").count() >= 7, "Report needs room photographs and item crops"
                report.screenshot(path=str(ARTIFACTS / "04-report.png"), full_page=True)
                report.close()
                page.locator("#room-list").get_by_text("Entry Bedroom", exact=False).first.click()
                page.locator("#item-legend").get_by_text("Bedside table", exact=False).first.click()
                page.locator("#edit-item-button").click()
                page.locator("#delete-item-button").click()
                page.locator("#delete-form").locator('button[type="submit"]').click()
                assert page.locator("#item-count").inner_text().strip() == "23", "Confirmed deletion must recalculate totals"
                assert not external, f"Offline demo made external requests: {external}"
                assert not errors, f"Browser JavaScript errors: {errors}"
                video = page.video
                context.close()
                if video:
                    generated = Path(video.path())
                    shutil.copyfile(generated, ARTIFACTS / "roomledger-demo.webm")
                browser.close()

                # A separate mobile pass verifies true responsive layout, not a scaled screenshot.
                mobile_browser = playwright.chromium.launch(**launch)
                mobile = mobile_browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
                mobile.goto(BASE, wait_until="networkidle")
                mobile.locator("#sample-button").click()
                mobile.locator("#run-toast").filter(has_text="6 rooms").wait_for(state="visible", timeout=90000)
                mobile.wait_for_timeout(500)
                overflow = mobile.evaluate("document.documentElement.scrollWidth - window.innerWidth")
                assert overflow <= 1, f"Mobile layout overflows by {overflow} pixels"
                mobile.locator("#dismiss-toast").click()
                mobile.evaluate("document.activeElement?.blur?.(); document.querySelector('.skip-link').hidden = true")
                mobile.screenshot(path=str(ARTIFACTS / "05-inventory-mobile.png"), full_page=True)
                mobile_browser.close()
        finally:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=5)
    recording = ARTIFACTS / "roomledger-demo.webm"
    assert recording.is_file() and recording.stat().st_size > 10000, "Full demo recording missing"
    summary = {"rooms": 6, "items": 24, "external_requests": 0, "mobile_width": 390,
               "screenshots": 5, "recording": str(recording.relative_to(ROOT))}
    (ARTIFACTS / "browser-summary.json").write_text(json.dumps(summary, indent=2))
    print("ROOMLEDGER_BROWSER_OK: six-room offline demo, edits, quake/Japanese, report, CSV, mobile, and recording")


if __name__ == "__main__":
    run()
