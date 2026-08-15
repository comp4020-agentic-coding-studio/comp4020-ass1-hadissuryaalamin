# Assignment 1

**What was the breakthrough that moved the work forward?**

The breakthrough wasn't a UI trick — it was catching, by driving the actual
browser instead of trusting `pnpm check`, that the finished build silently
never finished. After a third pivot dropped a multi-algorithm weight-dial grid
for one fixed graph walked by plain Dijkstra, shown against its own real
Python/Java source instead of pseudocode, `spec/assignment-1.test.ts` was
rewritten from that new mechanic outward rather than patched line-by-line.
Typecheck, build, and all 38 rewritten tests went green. The site still had a
bug: the finish-step state replay indexed one entry past the end of the
recorded pop sequence, throwing on every completed run and silently keeping
the result banner — the entire payoff, "here's the shortest path and its
cost" — hidden. Nothing in the automated suite surfaced it; clicking Run in a
real browser did.

**What did this work change about who I want to be as a software developer?**

It hardened a habit this project kept forcing on me: green checks are
permission to ask a harder question, not the answer to one. A fully passing
suite told me the code ran, never that the feature worked — those turned out
to be different claims, and the gap between them hid exactly the moment a
visitor was there to see. I also relearned, across three topic changes and
one thrown-away spec-compliant build, that being willing to discard working
code for a sharper idea is not wasted effort — it's the only way something
worth showing gets built instead of something merely finished.
