"""Record a silent screen-capture of the full walkthrough as .webm (add voice-over in any editor).

    python3 tests/record_demo.py http://127.0.0.1:5000  [LECTURER_PIN]

Output: tests/demo.webm (1440x900). Pauses are deliberate so the viewer can read.
"""
import asyncio
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://127.0.0.1:5000"
PIN = sys.argv[2] if len(sys.argv) > 2 else "1234"
OUT = Path(__file__).parent


async def type_slow(page, sel, text, delay=18):
    await page.click(sel)
    await page.type(sel, text, delay=delay)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1440, "height": 900}, record_video_dir=str(OUT / "video"), record_video_size={"width": 1440, "height": 900})
        page = await ctx.new_page()
        await page.goto(BASE + "/")
        await page.wait_for_timeout(3500)
        await page.mouse.wheel(0, 500)
        await page.wait_for_timeout(2500)

        # student
        await page.goto(BASE + "/learn")
        await page.wait_for_timeout(1500)
        await type_slow(page, "#alias", "owl42")
        await page.click("button[type=submit]")
        await page.wait_for_selector("#card-prompt:not(:empty)")
        await page.wait_for_timeout(2500)
        await page.click('#conf-scale button[data-v="4"]')
        await page.wait_for_selector("#chat .msg.tutor")
        await page.wait_for_timeout(1500)
        await type_slow(page, "#input", "Big-O tells you how the number of steps grows when the input gets bigger, so O(n) means double the input, roughly double the work.")
        await page.click("#send")
        await page.wait_for_function("document.querySelectorAll('#chat .msg.tutor').length >= 2", timeout=60000)
        await page.wait_for_timeout(3000)
        await type_slow(page, "#input", "just tell me the answer")
        await page.click("#send")
        await page.wait_for_function("document.querySelectorAll('#chat .msg.tutor').length >= 3", timeout=60000)
        await page.wait_for_timeout(3000)
        await type_slow(page, "#input", "It's an upper bound on how the work grows, not a time in seconds, and it throws away constant factors and smaller terms because for big n they stop mattering.")
        await page.click("#send")
        try:
            await page.wait_for_selector(".bigcard.flipped", timeout=60000)
        except Exception:
            pass
        await page.wait_for_timeout(3500)

        # lecturer
        await page.goto(BASE + "/teach")
        if await page.locator("#pin").count():
            await type_slow(page, "#pin", PIN)
            await page.click("button[type=submit]")
        await page.wait_for_selector(".week-row")
        await page.wait_for_timeout(2000)
        href = await page.locator("a:has-text('Gap report')").first.get_attribute("href")
        await page.goto(BASE + href)
        await page.wait_for_selector(".gapbar")
        await page.wait_for_timeout(2500)
        await page.click(".gapbar >> nth=0")
        await page.wait_for_timeout(3000)
        await page.click("[data-reteach] >> nth=0")
        await page.wait_for_function("document.querySelector('.reteach .md') && document.querySelector('.reteach .md').textContent.length > 40", timeout=60000)
        await page.wait_for_timeout(4000)
        await page.mouse.wheel(0, 400)
        await page.wait_for_timeout(2000)

        # editor
        href = await page.locator("a:has-text('Edit outcomes')").first.get_attribute("href")
        await page.goto(BASE + href)
        await page.wait_for_selector(".outcome-edit")
        await page.wait_for_timeout(3000)
        await page.mouse.wheel(0, 300)
        await page.wait_for_timeout(2000)

        await page.goto(BASE + "/about")
        await page.wait_for_timeout(3000)
        await ctx.close()
        await b.close()
        vids = sorted((OUT / "video").glob("*.webm"), key=lambda f: f.stat().st_mtime)
        if vids:
            vids[-1].rename(OUT / "demo.webm")
            print("wrote", OUT / "demo.webm")


asyncio.run(main())
