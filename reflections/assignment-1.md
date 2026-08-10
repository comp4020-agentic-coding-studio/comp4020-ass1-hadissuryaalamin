# Assignment 1

**What was the breakthrough that moved the work forward?**

Not a bug fix — noticing that "watch A* find a path on a grid" is the generic
version of this topic, built as a student demo hundreds of times, and proves
nothing a visitor couldn't get from a Wikipedia gif. The sharper claim that
actually moved the build forward was realizing Dijkstra, A*, and greedy
best-first aren't three algorithms to show side by side, but one weighted
search at three settings of a single dial — and that the dial has a point
where it quietly stops keeping its promise. The second breakthrough was
proving that specific claim as a unit test, on the real search engine, before
building a single pixel of grid or animation on top of it: a hand-built maze
that lures a highly-weighted search into a dead-end-adjacent trap, verified to
return a strictly longer path past weight ~2.6 while Dijkstra and true A* both
still find the optimal one. Validating the "gotcha" first meant the whole
visual build had something real to demonstrate rather than hoping the maze
would work out once wired up.

**What did this work change about who I want to be as a software developer?**

It sharpened a habit I'd already started forming earlier in this same project:
treat "the checks are green" as permission to ask a harder question, not as
the answer to one. That showed up twice here, in two different forms. Once as
a design habit — before touching any UI, prove the core claim (the trap maze
actually traps) as a cheap, fast unit test, so an expensive animation is never
built on top of an assumption that turns out false. And once as a testing
habit — after the UI existed and `pnpm check` was fully green, still write a
throwaway test that drives the real controller through real events, because a
green typecheck and a passing build both answer "does this compile," not "does
tapping a cell actually paint a wall." I want to keep asking both versions of
that question by default, not just when a check happens to fail.
