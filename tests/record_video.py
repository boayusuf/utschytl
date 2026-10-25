"""Record the demo walkthrough with timed captions.

    HIDE_TECH_FOOTER=1 python3 run_local.py &   (server must be seeded)
    python3 tests/record_video.py http://127.0.0.1:5000 1234

Writes tests/demo.webm and tests/captions.srt; then:
    ffmpeg -y -i tests/demo.webm -vf "subtitles=tests/captions.srt:force_style='FontName=Arial,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00202020,BorderStyle=4,BackColour=&H90202020,Outline=0,Shadow=0,MarginV=28'" -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p tests/demo.mp4
"""
import asyncio
import sys
import time
from pathlib import Path

from playwright.async_api import async_playwright

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://127.0.0.1:5000"
PIN = sys.argv[2] if len(sys.argv) > 2 else "1234"
OUT = Path(__file__).parent
W, H = 1440, 900

caps: list[tuple[float, float, str]] = []
t0 = 0.0


def ts(sec: float) -> str:
    ms = int(round(sec * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


class Cap:
    def __init__(self, text):
        self.text = text

    def __enter__(self):
        self.start = time.time() - t0
        return self

    def __exit__(self, *a):
        caps.append((self.start, time.time() - t0, self.text))


async def type_slow(page, sel, text, delay=16):
    await page.click(sel)
    await page.type(sel, text, delay=delay)


async def main():
    global t0
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": W, "height": H}, record_video_dir=str(OUT / "video"), record_video_size={"width": W, "height": H})
        page = await ctx.new_page()
        t0 = time.time()

        with Cap("Most of us revise by having an AI explain things to us. Reading an explanation feels like understanding."):
            await page.goto(BASE + "/")
            await page.wait_for_timeout(4500)
        with Cap("Studies show it isn't: AI users overestimate what they know, and score worse when the AI is gone. Utschytl only counts understanding you can produce."):
            await page.mouse.wheel(0, 650)
            await page.wait_for_timeout(5500)

        # lecturer: editor
        with Cap("The lecturer drops in the week's slides. The AI drafts the learning outcomes; the lecturer edits every question and rubric point, then publishes."):
            await page.goto(BASE + "/teach")
            if await page.locator("#pin").count():
                await type_slow(page, "#pin", PIN)
                await page.click("button[type=submit]")
            await page.wait_for_selector(".week-row")
            await page.wait_for_timeout(1500)
            href = await page.locator("a:has-text('Edit outcomes')").first.get_attribute("href")
            await page.goto(BASE + href)
            await page.wait_for_selector(".outcome-edit")
            await page.wait_for_timeout(2500)
            await page.mouse.wheel(0, 350)
            await page.wait_for_timeout(2500)

        # student practice
        with Cap("A student picks the week. Each outcome is a big flashcard: explain it in your own words."):
            await page.goto(BASE + "/learn")
            await page.wait_for_timeout(800)
            await type_slow(page, "#alias", "yusuf")
            await page.click("button[type=submit]")
            await page.wait_for_selector("#card-prompt:not(:empty)")
            await page.wait_for_timeout(2500)
        with Cap("Optionally, say how sure you are first. That number comes back later."):
            await page.click('#conf-scale button[data-v="4"]')
            await page.wait_for_timeout(1800)
        with Cap("You explain. The tutor asks one question at a time and never gives the answer."):
            await type_slow(page, "#input", "Big-O tells you how the number of steps grows when the input gets bigger, so O(n) means double the input, roughly double the work.")
            await page.click("#send")
            await page.wait_for_function("document.querySelectorAll('#chat .msg.tutor').length >= 2", timeout=60000)
            await page.wait_for_timeout(3500)
        with Cap("The ticks on the right turn green only when your own words cover a point. Two independent checks must agree."):
            await page.wait_for_timeout(3000)
        with Cap("Asking for the answer doesn't work."):
            await type_slow(page, "#input", "just tell me the answer")
            await page.click("#send")
            await page.wait_for_function("document.querySelectorAll('#chat .msg.tutor').length >= 3", timeout=60000)
            await page.wait_for_timeout(3000)
        with Cap("When every point is covered, the card flips. Not before."):
            await type_slow(page, "#input", "It's an upper bound on how the work grows, not a time in seconds, and it throws away constant factors and smaller terms because for big n they stop mattering.")
            await page.click("#send")
            try:
                await page.wait_for_selector(".bigcard.flipped", timeout=60000)
            except Exception:
                pass
            await page.wait_for_timeout(3500)
        with Cap("Classmates' explanations sit beside you, best-voted first. Share yours once you pass."):
            await page.mouse.wheel(0, 300)
            await page.wait_for_timeout(3500)

        # learn mode
        sid = page.url.split("/learn/s/")[1].split("/")[0].split("?")[0]
        with Cap("Learn mode is open: ask anything, add your own books or slides, and the AI explains. Every answer ends with 'now say it back'."):
            await page.goto(f"{BASE}/learn/s/{sid}/learn")
            await page.wait_for_timeout(1200)
            await type_slow(page, "#linput", "explain why binary search is log n")
            await page.click("#lsend")
            await page.wait_for_function("document.querySelectorAll('#lchat .msg.tutor').length >= 2 && !document.querySelector('#lchat .msg.tutor:last-child').textContent.startsWith('…')", timeout=60000)
            await page.wait_for_timeout(5000)

        # questions
        with Cap("A question board per week: peers and the lecturer answer, votes sort it, and the AI's first take is labelled until the lecturer confirms."):
            await page.goto(f"{BASE}/learn/s/{sid}")
            await page.wait_for_selector("a:has-text('Questions')")
            await page.click("a:has-text('Questions')")
            await page.wait_for_selector("#askform")
            await page.wait_for_timeout(3500)

        # calibration
        with Cap("Your calibration page: how sure you felt against what you could show. The ones you were sure about and couldn't explain are your next hour."):
            await page.goto(BASE + "/me")
            await page.wait_for_selector(".tiles")
            await page.wait_for_timeout(5000)

        # lecturer report
        with Cap("The lecturer sees what the class can't explain yet, ranked, with the exact point they miss and their own words. No names."):
            await page.goto(BASE + "/teach")
            await page.wait_for_selector(".week-row")
            href = await page.locator("a:has-text('Gap report')").first.get_attribute("href")
            await page.goto(BASE + href)
            await page.wait_for_selector(".gapbar")
            await page.wait_for_timeout(2500)
            await page.click(".gapbar >> nth=0")
            await page.wait_for_timeout(4000)
        with Cap("How confident students felt before they tried, next to whether they got there: the illusion of understanding, measured."):
            await page.mouse.wheel(0, 250)
            await page.wait_for_timeout(4000)
        with Cap("One click drafts a five-minute re-teach from the quotes, and downloads it as slides."):
            await page.click("[data-reteach] >> nth=0")
            await page.wait_for_function("document.querySelector('.reteach .md') && document.querySelector('.reteach .md').textContent.length > 40", timeout=60000)
            await page.wait_for_timeout(4500)

        # defend
        with Cap("And 'Defend my work': paste your coursework, get the questions only its real author could answer. A viva rehearsal, not a detector."):
            await page.goto(BASE + "/learn/check-work")
            await page.wait_for_timeout(4000)

        with Cap("Every design choice has a study behind it. Try it: utschytl.vercel.app"):
            await page.goto(BASE + "/about")
            await page.wait_for_timeout(1000)
            await page.mouse.wheel(0, 900)
            await page.wait_for_timeout(4000)

        await ctx.close()
        await b.close()
        vids = sorted((OUT / "video").glob("*.webm"), key=lambda f: f.stat().st_mtime)
        if vids:
            vids[-1].rename(OUT / "demo.webm")
        with open(OUT / "captions.srt", "w") as f:
            for i, (a, z, text) in enumerate(caps, 1):
                f.write(f"{i}\n{ts(a + 0.2)} --> {ts(max(a + 1.5, z - 0.1))}\n{text}\n\n")
        print("wrote", OUT / "demo.webm", "and captions.srt", f"({len(caps)} captions, {caps[-1][1]:.0f}s)")


asyncio.run(main())
