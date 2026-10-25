"""Seed a demo course with one published week and realistic simulated attempts, so the
lecturer report is populated when judges first open the app.

    python -m server.seed            # seeds (adds) the demo week
    python -m server.seed --reset    # wipes the store first

Simulated students are deliberately imperfect: some are confident and wrong,
some hesitant and right, a few give up. Their text is written to read like
first-year CS students, not like a model.
"""
from __future__ import annotations

import random
import sys
from datetime import datetime, timedelta, timezone

from . import prompts
from .store import get_store, new_id

COURSE = {"title": "Informatics 1: Introduction to Computation", "code": "INFR08025"}
WEEK = {"number": 5, "title": "Asymptotic complexity: Big-O, growth and what it hides"}

# Each outcome: title, prompt, slide_ref, criteria [(text, answer_terms)], misconceptions
OUTCOMES = [
    (
        "What Big-O describes",
        "Explain in your own words what it means to say an algorithm is O(n), and what Big-O is deliberately not telling you.",
        "slides 2–4",
        [
            ("Says Big-O describes how running time (or steps) grows as the input size grows", ["growth rate", "scales with input"]),
            ("Says it is an upper bound on growth, not an exact running time in seconds", ["upper bound", "asymptotic"]),
            ("Mentions that constant factors and lower-order terms are dropped", ["constant factors", "lower-order terms"]),
        ],
        ["O(n) means it takes n seconds or n milliseconds", "Big-O is the average time an algorithm takes"],
    ),
    (
        "Why constants are dropped",
        "Explain why 3n + 20 and n are both written O(n), and describe one situation where a programmer should still care about the 3 and the 20.",
        "slides 5–7",
        [
            ("Explains that for large n the linear term dominates so the shape of growth is the same", ["dominates", "same shape"]),
            ("Gives a concrete case where constants matter: small inputs, tight loops, hardware, real-time limits", ["small inputs", "in practice"]),
        ],
        ["Dropping constants means the constants are zero or irrelevant in all cases", "O(n) code is always faster than O(n log n) code"],
    ),
    (
        "Worst, best and average case",
        "Explain the difference between worst-case and average-case complexity, using linear search as your example.",
        "slides 8–9",
        [
            ("Distinguishes worst case (element absent or last) from average case over inputs", ["worst case", "average case"]),
            ("States linear search is O(n) in the worst case and why", ["last position", "not present"]),
            ("Says Big-O is usually quoted for the worst case unless stated otherwise", ["by default", "unless stated"]),
        ],
        ["Big-O always means the average case", "Best case is what Big-O measures"],
    ),
    (
        "Reading nested loops",
        "Explain how you work out the complexity of two nested loops over the same array, and why the answer is not simply 2n.",
        "slides 10–12",
        [
            ("Explains that the inner loop runs fully for every iteration of the outer loop, so the work multiplies", ["multiply", "n times n"]),
            ("Arrives at O(n²) and contrasts it with sequential loops giving O(n) + O(n) = O(n)", ["n squared", "quadratic"]),
        ],
        ["Nested loops add up to 2n", "Any loop inside a loop is O(n log n)"],
    ),
    (
        "Where log n comes from",
        "Explain why binary search is O(log n) without using a formula: what happens to the problem at each step?",
        "slides 13–15",
        [
            ("Says each step halves the remaining search space", ["halves", "half"]),
            ("Connects repeated halving to the number of steps being about log₂ n", ["log base 2", "doublings"]),
            ("Notes the precondition that the data must be sorted", ["sorted"]),
        ],
        ["Binary search is O(log n) because it looks at half the elements", "Binary search works on any list"],
    ),
    (
        "Comparing growth rates",
        "Put O(1), O(log n), O(n), O(n log n), O(n²) and O(2ⁿ) in order and explain, with a sense of scale, why the gap between the last two matters so much.",
        "slides 16–18",
        [
            ("Gives the correct order from slowest-growing to fastest-growing", ["ascending order"]),
            ("Explains that exponential growth doubles with each extra input item, so it becomes infeasible quickly", ["doubles", "infeasible", "intractable"]),
            ("Gives a rough sense of scale (e.g. n = 60 for 2ⁿ is already astronomical, n² for n = 1000 is a million)", ["million", "astronomical"]),
        ],
        ["n² grows faster than 2ⁿ", "O(n log n) is roughly the same as O(n²) in practice"],
    ),
    (
        "Space complexity",
        "Explain what space complexity measures and give an example of an algorithm that trades extra space for less time.",
        "slides 19–20",
        [
            ("Says space complexity measures extra memory used as a function of input size, not counting the input itself", ["auxiliary", "extra memory"]),
            ("Gives a valid time–space trade-off example such as memoisation, a hash set for duplicates, or merge sort's buffer", ["memoisation", "hash", "lookup table"]),
        ],
        ["Space complexity includes the size of the input", "Faster algorithms always use less memory"],
    ),
    (
        "Big-O and real speed",
        "Two programs are both O(n log n), but one runs ten times faster on your laptop. Explain how that is possible and what Big-O can and cannot predict.",
        "slides 21–22",
        [
            ("Explains that Big-O hides constants, memory behaviour, language and hardware differences", ["constants", "cache", "implementation"]),
            ("Says Big-O predicts how time changes as n grows, not absolute time, so both will scale the same way", ["scaling", "relative growth"]),
        ],
        ["Same Big-O means same speed", "Big-O predicts how many seconds a program takes"],
    ),
    (
        "Recognising O(n log n)",
        "Explain why comparison-based sorting such as merge sort is O(n log n), by describing where the n and the log n each come from.",
        "slides 23–25",
        [
            ("Attributes log n to the number of levels of halving (recursion depth)", ["levels", "recursion depth", "halving"]),
            ("Attributes n to the linear work of merging at each level", ["merge step", "linear work per level"]),
        ],
        ["Merge sort is O(n log n) because it is faster than bubble sort", "The log n comes from comparing pairs"],
    ),
    (
        "Choosing by complexity",
        "You need to check whether any value appears twice in a list of a million numbers. Explain which approach you would pick, its complexity, and what you are giving up.",
        "slides 26–27",
        [
            ("Rejects the naive nested-loop O(n²) approach for a million items, with a sense of why", ["trillion", "n squared"]),
            ("Proposes sort-then-scan O(n log n) or a hash set O(n), and names the complexity", ["hash set", "sort then scan"]),
            ("Names the trade-off: extra memory for the set, or the cost of sorting / destroying order", ["memory", "trade-off"]),
        ],
        ["A million items is small enough that O(n²) is fine", "Hash sets are O(n log n)"],
    ),
]

STUDENT_LABELS = {'Says Big-O describes how running time (or steps) grows as the input size grows': 'Says what Big-O is actually measuring', 'Says it is an upper bound on growth, not an exact running time in seconds': 'Says what kind of bound it is, and what it is not', 'Mentions that constant factors and lower-order terms are dropped': 'Says what gets ignored on purpose', 'Explains that for large n the linear term dominates so the shape of growth is the same': 'Explains why the two look the same for big inputs', 'Gives a concrete case where constants matter: small inputs, tight loops, hardware, real-time limits': 'Gives a concrete case where the hidden numbers still matter', 'Distinguishes worst case (element absent or last) from average case over inputs': 'Distinguishes the two cases with a concrete input for each', 'States linear search is O(n) in the worst case and why': "Gives linear search's worst-case complexity and the reason", 'Says Big-O is usually quoted for the worst case unless stated otherwise': 'Says which case people mean by default', 'Explains that the inner loop runs fully for every iteration of the outer loop, so the work multiplies': 'Explains how the two loops combine, not just the result', 'Arrives at O(n²) and contrasts it with sequential loops giving O(n) + O(n) = O(n)': 'Gives the answer and contrasts it with loops that are one after the other', 'Says each step halves the remaining search space': 'Describes what happens to the problem at each step', 'Connects repeated halving to the number of steps being about log₂ n': 'Connects that step-by-step behaviour to the number of steps', 'Notes the precondition that the data must be sorted': 'Names the precondition on the input', 'Gives the correct order from slowest-growing to fastest-growing': 'Puts them in the right order', 'Explains that exponential growth doubles with each extra input item, so it becomes infeasible quickly': 'Explains what the fastest-growing one does when n goes up by one', 'Gives a rough sense of scale (e.g. n = 60 for 2ⁿ is already astronomical, n² for n = 1000 is a million)': 'Gives a rough sense of scale with real numbers', 'Says space complexity measures extra memory used as a function of input size, not counting the input itself': 'Says what space complexity counts, and what it does not', "Gives a valid time–space trade-off example such as memoisation, a hash set for duplicates, or merge sort's buffer": 'Gives a real example of trading one resource for the other', 'Explains that Big-O hides constants, memory behaviour, language and hardware differences': 'Explains what Big-O hides that could cause the difference', 'Says Big-O predicts how time changes as n grows, not absolute time, so both will scale the same way': 'Says what Big-O does predict about the two programs', 'Attributes log n to the number of levels of halving (recursion depth)': 'Says where the log n part comes from', 'Attributes n to the linear work of merging at each level': 'Says where the n part comes from', 'Rejects the naive nested-loop O(n²) approach for a million items, with a sense of why': 'Says what the obvious approach costs and why that is too much', 'Proposes sort-then-scan O(n log n) or a hash set O(n), and names the complexity': 'Proposes a better approach and names its complexity', 'Names the trade-off: extra memory for the set, or the cost of sorting / destroying order': 'Names what the better approach gives up'}

# Simulated students: (alias, profile). Profiles drive confidence and how far they get.
STUDENTS = [
    ("owl42", "strong"),
    ("quietfox", "strong"),
    ("mara_k", "mid"),
    ("dp_2026", "mid"),
    ("jj", "overconfident"),
    ("sam.o", "overconfident"),
    ("lin", "hesitant"),
    ("tariq", "gives_up"),
    ("nabila", "mid"),
]

# Realistic student text per outcome index: (good_full, partial, wrong)
TEXT = {
    0: (
        "Big-O tells you how the number of steps grows when the input gets bigger, so O(n) means if I double the list the work roughly doubles. It's an upper bound on the growth, not an actual time in seconds, and it throws away constants and smaller terms because they stop mattering for huge n.",
        "O(n) means the time grows in a straight line with the input. It doesn't tell you the actual seconds.",
        "O(n) basically means it takes n milliseconds, like the average time for the algorithm. It's a way to measure speed.",
    ),
    1: (
        "For big n the n part dominates, 3n+20 and n have the same shape so we call both O(n). But if n is small, or the loop runs billions of times in a game frame, the 3x slowdown is real and I'd care about it.",
        "They are the same because when n is large the 3 and the 20 don't change the shape of the graph much.",
        "We drop the constants because they are basically zero compared to n, so they never matter and O(n) code is always faster than O(n log n).",
    ),
    2: (
        "Worst case for linear search is when the thing is last or not there at all, you check all n so it's O(n). Average case is over all positions, about n/2 checks. When people just say O(n) they normally mean worst case unless they say otherwise.",
        "Worst case is when the element is at the end so you look at everything, that's O(n). Average is less.",
        "Big-O is the average time so for linear search it's n/2 which is O(n). Best case it's O(1) and that's what you quote.",
    ),
    3: (
        "The inner loop runs all the way through for every single step of the outer loop, so you multiply, n times n is n squared. If the loops were one after the other you'd add them, n + n, which is still O(n).",
        "You multiply the two loops so it's n times n. It's not 2n because they're nested not sequential.",
        "Two loops over the array means you go over it twice so it's 2n which is O(n). Nested just means inside.",
    ),
    4: (
        "Every step you look at the middle and throw away half of what's left. So you ask how many times can you halve n until there's one left, that's log base 2 of n. It only works because the list is sorted, otherwise you can't throw away a half.",
        "Each time you cut the problem in half so you only need about log n steps instead of n.",
        "It's O(log n) because you only look at half the elements, not all of them. It works on any list you give it.",
    ),
    5: (
        "O(1), O(log n), O(n), O(n log n), O(n²), O(2ⁿ). The jump to 2ⁿ matters because adding one item doubles the work. n=1000 squared is a million, fine. 2^60 is about a billion billion, you'd never finish, so exponential algorithms are basically unusable past tiny inputs.",
        "1, log n, n, n log n, n squared, 2 to the n. Exponential is the worst because it blows up fast.",
        "O(1), O(log n), O(n), O(n log n), O(2ⁿ), O(n²). n squared grows fastest because squaring is a big operation.",
    ),
    6: (
        "Space complexity is how much extra memory you use as the input grows, not counting the input itself. Memoisation is the classic trade: store answers you've already computed in a table so you never recompute them, more memory, less time.",
        "It's how much memory the algorithm uses. You can use more memory to be faster, like caching results.",
        "Space complexity is the size of the input plus whatever you use. Faster algorithms use less memory because they do less.",
    ),
    7: (
        "Big-O hides the constants: one might be in C with tight cache-friendly loops, the other in Python allocating objects everywhere. Big-O only says how time changes when n grows, both will scale the same way, it says nothing about the absolute seconds.",
        "One is just written better or in a faster language. Big-O doesn't include that stuff.",
        "If they're both O(n log n) they should take the same time, so the slow one probably has a bug or isn't really O(n log n).",
    ),
    8: (
        "Merge sort keeps halving the list so there are about log n levels of splitting. At each level you merge everything back together which touches all n elements once. n work per level times log n levels is n log n.",
        "The log n is from splitting in half each time, and the n is from merging.",
        "It's O(n log n) because that's the fastest sorting can be. The log comes from comparing pairs of elements.",
    ),
    9: (
        "Nested loops would be a million squared, a trillion comparisons, way too slow. I'd put everything in a hash set as I go and stop when I see a repeat, that's O(n), but it costs extra memory for the set. Sorting first then scanning neighbours is O(n log n) and no extra set, but you lose the original order.",
        "I'd use a hash set, O(n). Nested loops would be too slow for a million.",
        "A million isn't that many so I'd just use two loops and compare everything, it's O(n²) but computers are fast.",
    ),
}

RNG = random.Random(2026)


def _plan(profile: str, i: int):
    """Return (confidence, kind) where kind in full/partial/wrong/giveup."""
    if profile == "strong":
        return RNG.choice([4, 5, 4]), RNG.choices(["full", "partial"], [0.95, 0.05])[0]
    if profile == "mid":
        return RNG.choice([3, 4, 3, 2]), RNG.choices(["full", "partial", "wrong"], [0.65, 0.25, 0.10])[0]
    if profile == "overconfident":
        return RNG.choice([5, 4, 5]), RNG.choices(["full", "partial", "wrong"], [0.3, 0.3, 0.4])[0]
    if profile == "hesitant":
        return RNG.choice([1, 2, 2]), RNG.choices(["full", "partial"], [0.6, 0.4])[0]
    return RNG.choice([2, 3]), RNG.choices(["giveup", "wrong", "partial"], [0.5, 0.3, 0.2])[0]


def seed(reset: bool = False) -> dict:
    s = get_store()
    if reset:
        s.reset()
    course = next((c for c in s.list("courses") if c["title"] == COURSE["title"]), None) or s.insert("courses", COURSE)
    already = [w for w in s.list("weeks", course_id=course["id"]) if w.get("title") == WEEK["title"]]
    if already and not reset:
        return {"course": course["id"], "week": already[0]["id"], "students": 0, "attempts": 0, "posts": 0, "skipped": True}
    week = s.insert("weeks", {**WEEK, "course_id": course["id"], "status": "published", "material_chars": 18450,
                              "material_excerpt": "[slide 1] Informatics 1 — Week 5: Asymptotic complexity ..."})
    outcome_rows = []
    for pos, (title, prompt, slide_ref, crits, miscs) in enumerate(OUTCOMES):
        criteria = [{"id": new_id()[:8], "text": t, "student_label": STUDENT_LABELS.get(t, ""), "answer_terms": terms} for t, terms in crits]
        outcome_rows.append(
            s.insert("outcomes", {"week_id": week["id"], "position": pos, "title": title, "prompt": prompt,
                                  "slide_ref": slide_ref, "criteria": criteria, "common_misconceptions": miscs})
        )

    base = datetime.now(timezone.utc) - timedelta(days=3)
    n_attempts = 0
    for si, (alias, profile) in enumerate(STUDENTS):
        sess = s.insert("sessions", {"week_id": week["id"], "alias": alias, "created_at": (base + timedelta(hours=si * 5)).isoformat()})
        how_many = len(OUTCOMES) if profile in ("strong", "mid") else RNG.randint(5, 8)
        for i, o in enumerate(outcome_rows[:how_many]):
            conf, kind = _plan(profile, i)
            full, partial, wrong = TEXT[i]
            t0 = base + timedelta(hours=si * 5, minutes=i * 6)
            att = s.insert("attempts", {"session_id": sess["id"], "outcome_id": o["id"], "confidence_before": conf,
                                        "status": "in_progress", "student_turns": 0, "target_attempts": 0,
                                        "target_id": None, "met_ids": [], "misconceptions": [], "created_at": t0.isoformat()})
            turns = [("tutor", prompts.TUTOR_OPENER, None)]
            crit_ids = [c["id"] for c in o["criteria"]]
            if kind == "full":
                turns += [("student", partial, None), ("tutor", "Good start. What is it NOT telling you, and what gets left out on purpose?", None),
                          ("student", full, None), ("tutor", f"You covered every part of this in your own words. Marked as understood.", None)]
                met, status, misc, st = crit_ids, "mastered", [], 2
            elif kind == "partial":
                turns += [("student", partial, None), ("tutor", "You have the first half. Can you give me a concrete case where the rest would show up?", None),
                          ("student", partial + " I'm not sure about the rest honestly.", None),
                          ("tutor", "Hint: think about what happens at the extremes. Try the small-input case.", {"hint": True})]
                met, status, misc, st = crit_ids[:1], "in_progress", [], 2
            elif kind == "wrong":
                turns += [("student", wrong, None), ("tutor", "Suppose a classmate said the opposite. What would you point to that shows they are wrong?", None),
                          ("student", wrong.split(".")[0] + ". I think that's right.", None),
                          ("tutor", "Hint: picture the input ten times bigger. What changes, and what doesn't?", {"hint": True})]
                met, status, misc, st = [], "in_progress", o["common_misconceptions"][:1], 2
            else:
                turns += [("student", "honestly no idea, can you just tell me", None),
                          ("tutor", "I won't give it away, but let's make it smaller: what is the one word in the prompt you could explain to a friend?", None)]
                met, status, misc, st = [], "skipped", [], 1
            for k, (role, content, meta) in enumerate(turns):
                s.insert("turns", {"attempt_id": att["id"], "role": role, "content": content, "judge": None, "meta": meta,
                                   "created_at": (t0 + timedelta(seconds=40 * k)).isoformat()})
            s.update("attempts", att["id"], {"status": status, "met_ids": met, "misconceptions": misc, "student_turns": st,
                                             "target_id": next((c for c in crit_ids if c not in met), None), "target_attempts": st})
            n_attempts += 1
    # class wall: a few shared explanations with votes on the first outcomes
    POSTS = [
        (0, "owl42", True, "Big-O = how the work grows as the input grows. Not seconds, not the exact count: the shape of the curve for huge inputs, with constants and small terms thrown away."),
        (0, "mara_k", True, "Think of it as 'if I 10x the input, roughly what happens to the time?' O(n) → 10x. O(n²) → 100x. That's all it promises."),
        (0, "jj", False, "It's the average time an algorithm takes to run, measured in n."),
        (4, "quietfox", True, "Binary search throws away half the list every step. Ask: how many times can I halve n before one is left? That's log₂ n. Only works if the list is sorted, otherwise you can't throw away a half."),
        (4, "nabila", False, "It only looks at half the elements so it's faster, that's why it's log."),
        (3, "owl42", True, "Inner loop runs fully for EVERY outer step, so you multiply: n·n. Two loops one after another you add: n+n, still O(n). Nested = multiply, sequential = add."),
    ]
    sess_by_alias = {}
    for alias, _ in STUDENTS:
        ss = [x for x in s.list("sessions", week_id=week["id"]) if x.get("alias") == alias]
        if ss:
            sess_by_alias[alias] = ss[0]
    ids = {alias: new_id() for alias, _ in STUDENTS}
    for oi, alias, verified, text in POSTS:
        sess = sess_by_alias.get(alias)
        if not sess:
            continue
        s.update("sessions", sess["id"], {"student_id": ids[alias]})
        post = s.insert("posts", {"session_id": sess["id"], "student_id": ids[alias], "week_id": week["id"], "outcome_id": outcome_rows[oi]["id"],
                                  "alias": alias, "content": text, "verified": verified})
        voters = [a for a, _ in STUDENTS if a != alias]
        RNG.shuffle(voters)
        n_up = RNG.randint(4, 7) if verified else RNG.randint(0, 1)
        n_down = RNG.randint(0, 1) if verified else RNG.randint(2, 4)
        for v in voters[:n_up]:
            s.insert("votes", {"post_id": post["id"], "student_id": ids[v], "value": 1})
        for v in voters[n_up:n_up + n_down]:
            s.insert("votes", {"post_id": post["id"], "student_id": ids[v], "value": -1})
    return {"course": course["id"], "week": week["id"], "students": len(STUDENTS), "attempts": n_attempts, "posts": len(POSTS)}


if __name__ == "__main__":
    out = seed(reset="--reset" in sys.argv)
    print(out)
