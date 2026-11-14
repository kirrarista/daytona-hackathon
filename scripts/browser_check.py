"""Real-Chromium desktop/mobile acceptance and offline demo recording."""
from __future__ import annotations

import json
import os
import re
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


def measured_contrasts(page) -> dict[str, float | str]:
    colors = page.evaluate("""() => {
      const body = getComputedStyle(document.body);
      return {
        theme: document.documentElement.dataset.theme,
        background: body.backgroundColor,
        text: getComputedStyle(document.querySelector('.hero-copy h1')).color,
        secondary: getComputedStyle(document.querySelector('.hero-summary')).color,
        accent: getComputedStyle(document.querySelector('.hero-copy .section-marker')).color,
      };
    }""")

    def luminance(css_color: str) -> float:
        channels = [float(value) / 255 for value in re.findall(r"[\d.]+", css_color)[:3]]
        linear = [value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4 for value in channels]
        return sum(value * weight for value, weight in zip(linear, (0.2126, 0.7152, 0.0722)))

    def ratio(foreground: str) -> float:
        high, low = sorted((luminance(foreground), luminance(colors["background"])), reverse=True)
        return (high + 0.05) / (low + 0.05)

    result = {"theme": colors["theme"], "body_text": ratio(colors["text"]),
              "secondary_text": ratio(colors["secondary"]), "accent_text": ratio(colors["accent"])}
    for role in ("body_text", "secondary_text", "accent_text"):
        assert result[role] >= 4.5, f"{result['theme']} {role} contrast is only {result[role]:.2f}:1"
    return result


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
                assert page.locator("html").get_attribute("data-theme") == "light", "Light must be the first-run default"
                light_contrast = measured_contrasts(page)
                page.screenshot(path=str(ARTIFACTS / "01-welcome.png"), full_page=True)
                page.locator("#theme-toggle").click()
                assert page.locator("html").get_attribute("data-theme") == "dark"
                dark_contrast = measured_contrasts(page)
                page.screenshot(path=str(ARTIFACTS / "01b-welcome-dark.png"), full_page=True)
                page.reload(wait_until="networkidle")
                assert page.locator("html").get_attribute("data-theme") == "dark", "Theme preference must survive reload"
                page.locator("#theme-toggle").click()
                assert page.locator("html").get_attribute("data-theme") == "light"
                assert page.locator("html").get_attribute("data-currency") == "USD", "USD must be the independent first-run currency"
                page.locator("#currency-toggle").click()
                page.reload(wait_until="networkidle")
                assert page.locator("html").get_attribute("data-currency") == "JPY", "Currency preference must survive reload independently"
                assert page.locator("html").get_attribute("lang") == "en", "Currency selection must not select a language"
                page.locator("#currency-toggle").click()
                page.locator("#language-toggle").click()
                assert page.locator("html").get_attribute("lang") == "ja"
                assert "サンプルホーム" in page.locator("#sample-button").inner_text(), "Shared controls must translate before upload"
                page.reload(wait_until="networkidle")
                assert page.locator("html").get_attribute("lang") == "ja", "Language preference must survive reload"
                assert page.locator(".header-actions #language-toggle").is_visible(), "Language control must stay in the universal header"
                page.locator("#language-toggle").click()
                assert page.locator("html").get_attribute("lang") == "en"
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

                page.locator("#currency-toggle").click()
                assert page.locator("html").get_attribute("data-currency") == "JPY"
                assert "1,900,500" in page.locator("#total-value").inner_text(), "USD totals must convert at the disclosed rate"
                page.locator("#language-toggle").click()
                assert page.locator("html").get_attribute("lang") == "ja"
                assert page.locator("html").get_attribute("data-currency") == "JPY", "Language change must not change currency"
                page.locator("#currency-toggle").click()
                assert page.locator("html").get_attribute("data-currency") == "USD"
                assert page.locator("html").get_attribute("lang") == "ja", "Currency change must not change language"
                page.locator("#language-toggle").click()
                page.locator("#currency-toggle").click()
                assert page.locator("html").get_attribute("data-currency") == "JPY"
                assert page.locator("html").get_attribute("lang") == "en"

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
                assert price.input_value() == "135000", "Editor must display the converted JPY amount without changing language"
                assert "JPY" in page.locator('label[for="edit-price"]').inner_text(), "Editor must identify its active currency"
                price.fill("142500")
                page.locator("#edit-condition").select_option("fair")
                checkbox = form.locator('input[type="checkbox"]').first
                checkbox.check()
                form.locator('button[type="submit"], button:has-text("Save")').first.click()
                page.wait_for_timeout(300)
                assert "receipt checked" in page.locator("#item-legend").inner_text(), "Edited item must stay in current inventory"
                assert "fair" in page.locator("#inspector").inner_text().lower(), "Condition edit must update evidence"
                assert "142,500" in page.locator("#inspector").inner_text(), "JPY editor value must convert back to the USD inventory exactly once"
                assert "150 JPY" in page.locator("#currency-note").inner_text(), "Visible conversion-rate note required"

                page.locator("#mode-quake").click()
                page.locator("#readiness-score").wait_for(state="visible")
                page.locator("#language-toggle").click()
                page.wait_for_timeout(300)
                body_text = page.locator("body").inner_text()
                assert any(word in body_text for word in ("転倒", "家具", "耐震", "買い物")), "Japanese quake copy missing"
                assert "証拠台帳" in page.locator("#run-title").inner_text()
                assert "解放済み" in page.locator("#fleet").inner_text(), "Fleet states must translate after a run"
                assert "領収書" in page.locator("#inspector").inner_text() and "推定使用年数" in page.locator("#inspector").inner_text()
                assert "実際現金価額" in page.locator("#inspector").inner_text()
                assert "証拠の切り抜き" in page.locator("#inspector .inspector-crop img").get_attribute("alt")
                assert "わかりやすい表示" in page.locator("#plain-log-tab").inner_text()
                assert "Preparing" not in page.locator("#plain-log").inner_text(), "Existing plain logs must retranslate"
                assert "部屋" in page.locator("#run-toast").inner_text(), "Existing toast summaries must retranslate"
                page.locator("#edit-item-button").click()
                dialog_text = page.locator("#item-dialog").inner_text()
                assert "項目名" in dialog_text and "領収書あり" in dialog_text and "変更を保存" in dialog_text and "項目を削除" in dialog_text
                assert "Item label" not in dialog_text and "Save changes" not in dialog_text
                page.locator("#close-item-dialog").click()
                page.locator("#dismiss-toast").click()
                page.evaluate("document.activeElement?.blur?.(); document.querySelector('.skip-link').hidden = true")
                page.screenshot(path=str(ARTIFACTS / "03-quake-japanese.png"), full_page=True)
                page.locator("#language-toggle").click()
                assert "Your evidence ledger" in page.locator("#run-title").inner_text(), "English must restore dynamically"
                page.locator("#theme-toggle").click()
                assert page.locator("html").get_attribute("data-theme") == "dark", "Dark workbench must be available after a run"
                page.screenshot(path=str(ARTIFACTS / "03b-inventory-dark.png"), full_page=True)
                page.locator("#language-toggle").click()
                assert page.locator("html").get_attribute("lang") == "ja", "Report must be generated in selected language"

                with page.expect_download() as download_info:
                    page.locator("#csv-button").click()
                download = download_info.value
                assert download.suggested_filename == "roomledger-inventory.csv"
                csv_path = ARTIFACTS / "roomledger-inventory.csv"
                download.save_as(csv_path)
                csv_text = csv_path.read_text(encoding="utf-8-sig")
                assert "receipt checked" in csv_text and "fingerprint" in csv_text.lower(), "CSV must include current edits and evidence"
                assert "currency" in csv_text and "fx_jpy_per_usd" in csv_text and "142500" in csv_text, "CSV must include explicit JPY values and rate metadata"

                with page.expect_popup() as popup_info:
                    page.locator("#report-button").click()
                report = popup_info.value
                report.wait_for_load_state("domcontentloaded")
                report_text = report.locator("body").inner_text()
                assert "AI estimates — verify with receipts. Not an insurance appraisal." in report_text
                assert "receipt checked" in report_text and "写真の証拠フィンガープリント" in report_text and "UTC処理タイムスタンプ" in report_text
                assert "家財一覧" in report_text and "付録: 算出方法と証拠" in report_text and "ブラウザで編集した現在の台帳" in report_text
                assert "Consolidated inventory" not in report_text and "Annual depreciation" not in report_text, "Report chrome must translate completely"
                assert "1 USD ≈ 150 JPY" in report_text and "JPY" in report_text, "Report must identify display currency and conversion rate"
                assert report.locator("html").get_attribute("lang") == "ja"
                assert report.locator("img").count() >= 7, "Report needs room photographs and item crops"
                assert report.evaluate("getComputedStyle(document.documentElement).backgroundColor") == "rgb(255, 255, 255)", "Reports must remain light when opened from dark mode"
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
                assert mobile.locator("html").get_attribute("data-theme") == "light", "A fresh mobile browser must default to light"
                assert mobile.locator("html").get_attribute("data-currency") == "USD", "A fresh mobile browser has an independent USD default"
                mobile.locator("#sample-button").click()
                mobile.locator("#run-toast").filter(has_text="6 rooms").wait_for(state="visible", timeout=90000)
                mobile.locator("#language-toggle").click()
                assert mobile.locator("html").get_attribute("lang") == "ja"
                assert mobile.locator(".header-actions #language-toggle").is_visible(), "Mobile must retain universal language control"
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
               "screenshots": 7, "contrast": {"light": light_contrast, "dark": dark_contrast},
               "recording": str(recording.relative_to(ROOT))}
    (ARTIFACTS / "browser-summary.json").write_text(json.dumps(summary, indent=2))
    print("ROOMLEDGER_BROWSER_OK: six-room demo, light/dark themes with contrast and persistence, edits, quake/Japanese, light report, CSV, mobile, recording")


if __name__ == "__main__":
    run()
