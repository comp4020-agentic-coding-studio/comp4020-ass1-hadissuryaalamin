# Assignment 1

**What was the breakthrough that moved the work forward?**

The breakthrough wasn't a bug fix, it was noticing that a fully green
`pnpm check` didn't mean I was done. My first build — a six-stage pipeline
animating a rule-based `decideTool()` — satisfied every mechanical check the
spec asked for and still had no real point of view; the "decision" was just a
regex restating its own input. Once I named that gap out loud instead of
polishing the animation further, I went looking for a real idea to ground the
interaction in, landed on hidden-state-probing research, and rewrote the whole
mechanic around it: read a prompt and a model's stated reasoning, guess
whether it needs a tool, then watch a hidden-state probe agree with that
reasoning or catch it being wrong. That's a much smaller, sharper claim than
"visualize an agent pipeline," and it's the one that actually has something to
say.

**What did this work change about who I want to be as a software developer?**

It made me suspicious of my own "it works" reflex. Checks passing is necessary
but it answers "does this function," not "should this exist" or "does this
actually run the way I think it does" — I only found that out for the
interaction itself by writing a throwaway test that clicked through it,
because no browser tool was available to just look. I want to keep that habit
after this course: treat a green suite as permission to ask the harder
question, not as the answer to it.
