"""End-to-end walkthrough in mock mode. Run with the local server up:
    python3 run_local.py &   then   python3 -I tests/e2e.py
Takes screenshots into tests/screens/ for visual review."""
import asyncio
import json
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:5000"
OUT = Path(__file__).parent / "screens"
OUT.mkdir(exist_ok=True)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1366, "height": 900})
        page = await ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" and "ERR_TUNNEL" not in m.text else None)

        # ---- home
        await page.goto(BASE + "/")
        await page.screenshot(path=OUT / "01-home.png", full_page=True)

        # ---- student flow
        await page.goto(BASE + "/learn")
        await page.fill("#alias", "e2e")
        await page.click("button[type=submit]")
        await page.wait_for_selector("#card-prompt:not(:empty)")
        await page.screenshot(path=OUT / "02-practice-confidence.png", full_page=True)
        await page.click('#conf-scale button[data-v="4"]')
        await page.wait_for_selector("#chat .msg.tutor")
        await page.fill("#input", "O(n) means the time grows in a straight line as input size grows.")
        await page.click("#send")
        await page.wait_for_function("document.querySelectorAll('#chat .msg.tutor').length >= 2")
        await page.screenshot(path=OUT / "03-practice-chat.png", full_page=True)
        met = await page.locator("#rubric li.met").count()
        assert met >= 1, "expected at least one rubric point met after a decent explanation"
        await page.fill(
            "#input",
            "It's an upper bound on the growth rate, not seconds. Constant factors and lower-order terms are dropped because for large n they stop mattering.",
        )
        await page.click("#send")
        await page.wait_for_selector(".bigcard.flipped", timeout=10000)
        await page.screenshot(path=OUT / "04-practice-mastered.png", full_page=True)
        await page.click("#next-btn")
        await page.wait_for_selector("#chat .msg.tutor")
        # stuck path: three weak tries -> reveal -> explain back -> "seen"
        for m in ["no idea", "something about speed", "its fast i guess"]:
            n = await page.locator("#chat .msg.tutor").count()
            await page.fill("#input", m)
            await page.click("#send")
            await page.wait_for_function(f"document.querySelectorAll('#chat .msg.tutor').length > {n}")
        await page.wait_for_selector("#reveal:not([hidden])")
        await page.click("#reveal")
        await page.wait_for_selector("#chat .msg.reveal")
        await page.screenshot(path=OUT / "04b-reveal.png", full_page=True)
        await page.click("#chat .msg.reveal button")
        await page.fill("#input", "For large n the linear part dominates so 3n+20 and n have the same shape of growth. But in practice with small inputs or tight loops in real-time code, the constant factors still matter.")
        await page.click("#send")
        await page.wait_for_selector(".bigcard.flipped", timeout=10000)
        assert "Seen the answer" in await page.locator("#face-back .pill").text_content()
        await page.click("#next-btn")
        await page.wait_for_selector("#chat .msg.tutor")
        # skip the rest quickly to reach the summary
        for _ in range(12):
            if await page.locator("#summary:not([hidden])").count():
                break
            await page.wait_for_selector("#chat-wrap:not([hidden])")
            await page.click("#skip")
            await page.wait_for_timeout(150)
        await page.wait_for_selector("#summary:not([hidden])")
        await page.screenshot(path=OUT / "05-summary.png", full_page=True)

        # ---- class wall: share + vote on the first outcome
        sid = page.url.rsplit("/", 1)[-1]
        await page.goto(page.url)
        await page.wait_for_function("document.getElementById('card-prompt').textContent.length > 0")
        await page.click("#outcome-nav button >> nth=0")
        await page.wait_for_function("document.querySelectorAll('#wall .post').length >= 1")
        await page.fill("#wallinput", "Big-O is about the shape of growth, not the seconds; constants vanish for big n.")
        await page.click("#wallbtn")
        await page.wait_for_function("document.getElementById('wallstatus').textContent === 'Shared.'")
        await page.click("#wall .post .vote >> nth=0")
        await page.wait_for_timeout(300)
        await page.screenshot(path=OUT / "05b-wall.png", full_page=True)

        # ---- learn mode: ask, add material, make cards
        await page.goto(f"{BASE}/learn/s/{sid}/learn")
        await page.fill("#linput", "explain why binary search is log n")
        await page.click("#lsend")
        await page.wait_for_function("document.querySelectorAll('#lchat .msg.tutor').length >= 2 && !document.querySelector('#lchat .msg.tutor:last-child').textContent.startsWith('…')", timeout=60000)
        await page.fill('#matform textarea[name="text"]', ("Hash tables store key-value pairs using a hash function to compute an index. Collisions happen when two keys hash to the same index. "
                                                          "Chaining and open addressing resolve collisions. Load factor is entries divided by buckets. ") * 4)
        await page.click("#matbtn")
        await page.wait_for_function("document.getElementById('matstatus').textContent === 'Added.'")
        await page.click("#cardsbtn")
        await page.wait_for_function("document.getElementById('cardsstatus').textContent.includes('cards added')", timeout=60000)
        await page.screenshot(path=OUT / "05c-learn.png", full_page=True)
        await page.goto(f"{BASE}/learn/s/{sid}")
        await page.wait_for_selector("#outcome-nav .group")
        assert await page.locator("#outcome-nav .group").count() >= 2, "expected 'This week' and 'My own cards' groups"

        # ---- question board: ask, AI first take, vote
        await page.goto(f"{BASE}/learn/s/{sid}")
        await page.wait_for_selector("a:has-text('Questions')")
        await page.click("a:has-text('Questions')")
        await page.wait_for_selector("#askform")
        await page.fill("#title", "Why is binary search log n and not n/2?")
        await page.fill("#body", "I thought it looks at half the elements.")
        await page.click("#askform button[type=submit]")
        await page.wait_for_selector("#aibtn")
        await page.click("#aibtn")
        await page.wait_for_selector("#aitext", timeout=60000)
        await page.click("[data-vote] >> nth=0")
        await page.wait_for_selector("#thread")
        thread_url = page.url
        await page.screenshot(path=OUT / "05f-thread.png", full_page=True)

        # ---- profile
        await page.goto(BASE + "/me")
        await page.wait_for_selector(".tiles")
        await page.screenshot(path=OUT / "05d-me.png", full_page=True)

        # ---- coursework viva
        await page.goto(BASE + "/learn/check-work")
        code = "\n".join(f"def f{i}(x):\n    # step {i} of the pipeline\n    return x * {i} + 1\n" for i in range(12))
        await page.fill("#work", code)
        await page.click("#workbtn")
        await page.wait_for_selector("#card-prompt:not(:empty)", timeout=60000)
        assert "coursework" in (await page.locator("h1").first.text_content()).lower()
        await page.screenshot(path=OUT / "05e-viva.png", full_page=True)

        # ---- lecturer flow
        await page.goto(BASE + "/teach")
        await page.fill("#pin", "1234")
        await page.click("button[type=submit]")
        await page.wait_for_selector(".week-row")
        await page.screenshot(path=OUT / "06-teach.png", full_page=True)
        # draft a new week from pasted notes
        await page.fill("#course_title", "Test course")
        await page.fill("#week_number", "2")
        notes = ("Recursion is when a function calls itself. Every recursive function needs a base case that stops the recursion. "
                 "The call stack grows with each recursive call, which costs memory. Tail recursion can be optimised by some compilers. "
                 "Recursion and iteration can express the same computations; recursion is natural for trees. "
                 "Infinite recursion causes a stack overflow. Memoisation stores results of expensive calls. "
                 "Divide and conquer splits a problem into subproblems solved recursively. ") * 3
        await page.fill("#material", notes)
        await page.click("#draft-btn")
        await page.wait_for_selector(".outcome-edit", timeout=30000)
        await page.screenshot(path=OUT / "07-editor.png", full_page=True)
        # edit the first title and ensure autosave
        first = page.locator('.outcome-edit input[data-f="title"]').first
        await first.fill("Edited title")
        await page.wait_for_function("document.getElementById('save-status').textContent === 'All changes saved'", timeout=5000)
        await page.click("#publish")
        await page.wait_for_selector(".pill-teal")
        # lecturer answers the question and accepts it
        await page.goto(thread_url)
        await page.fill("#body", "Each step halves what is left; count the halvings.")
        await page.click("form[action$='/reply'] button[type=submit]")
        await page.wait_for_selector("[data-accept]")
        await page.click("[data-accept] >> nth=0")
        await page.wait_for_selector("text=Accepted answer")
        await page.click("[data-set='ai_confirmed']")
        await page.wait_for_selector("text=confirmed by the lecturer")
        # report of the seeded week
        await page.goto(BASE + "/teach")
        href = await page.locator("a:has-text('Gap report')").first.get_attribute("href")
        await page.goto(BASE + href)
        await page.wait_for_selector(".gapbar")
        await page.click(".gapbar >> nth=0")
        await page.wait_for_selector(".detail:not([hidden])")
        await page.click("[data-reteach] >> nth=0")
        await page.wait_for_function("document.querySelector('.reteach .md:not([hidden])') && document.querySelector('.reteach .md').textContent.length > 40")
        await page.screenshot(path=OUT / "08-report.png", full_page=True)
        assert await page.locator("text=How students explain it to each other").count() >= 1, "wall summary missing from report"
        # pptx export
        pptx_href = await page.locator("a[href$='.pptx']").first.get_attribute("href")
        resp = await page.request.get(BASE + pptx_href)
        assert resp.status == 200 and (await resp.body())[:2] == b"PK", "pptx export failed"
        await page.goto(BASE + href + "?live=1")
        await page.wait_for_selector(".notice")
        await page.screenshot(path=OUT / "08b-live.png", full_page=True)

        # ---- mobile check
        m = await b.new_context(viewport={"width": 390, "height": 844})
        mp = await m.new_page()
        await mp.goto(BASE + "/")
        await mp.screenshot(path=OUT / "09-mobile-home.png", full_page=True)
        await b.close()
        if errors:
            print("CONSOLE/PAGE ERRORS:\n" + "\n".join(errors))
            sys.exit(1)
        print("e2e ok")


asyncio.run(main())
