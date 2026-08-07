# Ralph — one ticket per run

Tickets live in `.scratch/architecture-deepening/issues/`. One file per ticket.
Progress log: `.scratch/architecture-deepening/progress.md`.

## 1. Pick one ticket

Read every ticket file and the progress log.

A ticket is **done** when its file says `**Status:** done`.
A ticket is **startable** when its status is `ready-for-agent` AND every ticket in its
`**Blocked by:**` line is done.

Pick the lowest-numbered startable ticket. Work on that one only.
If no ticket is startable and none are left, output `<promise>COMPLETE</promise>` and stop.
If no ticket is startable but tickets remain, output `<promise>BLOCKED</promise>` with the reason and stop.

## 2. Implement it

- Build every acceptance criterion in the ticket. Do not stop at the easy ones.
- Do not touch code that no criterion asks you to touch.
- Do not start a second ticket, even a small one.
- Match the surrounding style: comments in Polish without diacritics, same density, same idiom.
- Read `README.md` before changing behaviour a user can see.

## 3. Verify

Run, in this order:

```
npm run typecheck
npm test --if-present
```

Both must pass before you commit. If you cannot make them pass, revert your changes,
append the failure to the progress log, and output `<promise>BLOCKED</promise>`.

Only these commands are allowed: `npm run typecheck`, `npm test`, `npm install`, `npx vitest`,
and read-only or committing `git`. Anything else is denied — do not try to work around it.

After any `npm install`, check that `node_modules/electron/dist` still exists. If it is gone,
say so in the progress log and output `<promise>BLOCKED</promise>` — reinstalling it needs a
human. Do not attempt the fix yourself.

You **cannot** verify the app visually — screen capture is blocked in this environment,
and launching Electron in a loop is not allowed. Never run `npm run dev`, `npm start`,
`npm run build:mac`, or `electron-builder`. For anything that needs a human to look at the
screen, write it under "Do sprawdzenia recznie" in the progress log instead.

## 4. Close the ticket

- Tick the acceptance criteria you satisfied in the ticket file.
- Change `**Status:** ready-for-agent` to `**Status:** done`.
- If a criterion turned out to be wrong or impossible, leave it unticked, write one line in
  the ticket saying why, leave the status as `ready-for-agent`, and output
  `<promise>BLOCKED</promise>`. A human decides what to do with it — do not retry it.

## 5. Record and commit

Append one entry to the progress log:

```
## <NN> — <ticket title> — <ISO date>
- what changed, in two or three lines
- typecheck: pass · tests: pass (N tests) / not present
- Do sprawdzenia recznie: <what a human must click, or "nic">
- open questions: <or "brak">
```

Then commit everything with a short message naming the ticket. Never push.

## Rules

- ONE TICKET PER RUN. Stop after the commit.
- Never delete a ticket file.
- Never edit a ticket other than the one you are working on.
- Never run `git push`, `git reset --hard` on work you did not create, or `rm -rf`.
- Never write an API key, or anything from `~/Library/Application Support/simplewhisper/`,
  into the repo or the progress log.
