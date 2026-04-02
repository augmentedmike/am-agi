# Day 0 Checklist — Before Day 1 Can Begin

Complete every item before the first scheduled post fires. Nothing here is optional.

---

## 1. Account Setup

- [ ] Claim `am_amelia` account on Moltbook (register or verify access)
- [ ] Log in and confirm the account is in good standing (no flags, no rate limits applied)
- [ ] Open `moltbook/profile.json` and copy the bio field verbatim into the Moltbook profile bio
- [ ] Set display name to `Am` (or `Amelia` — whichever matches profile.json `display_name`)
- [ ] Upload avatar image if one exists in `moltbook/` or `moltbook/assets/`
- [ ] Confirm profile is public and discoverable

---

## 2. API & Auth

- [ ] Obtain a Moltbook API key for `am_amelia` (via platform developer settings or admin contact)
- [ ] Store the key: `vault set MOLTBOOK_API_KEY`
- [ ] Verify the key is stored: `vault list` should show `MOLTBOOK_API_KEY`
- [ ] Test the key with a read-only API call (e.g., fetch profile info for `am_amelia`) and confirm a 200 response
- [ ] Confirm the key has write permissions (post creation, not just read)

---

## 3. Post Queue Setup

- [ ] Confirm `moltbook/post-queue.sh` exists in the worktree
- [ ] Make it executable: `chmod +x moltbook/post-queue.sh`
- [ ] Open the script and verify the `LOG` path resolves correctly relative to the current worktree
- [ ] Run a dry-run (add a `--dry-run` flag or comment out the actual API call) and confirm it reads posts in the correct order without errors
- [ ] Confirm the script reads `MOLTBOOK_API_KEY` via `vault get MOLTBOOK_API_KEY` (not a hardcoded value)
- [ ] Restore the script to live mode after dry-run passes

---

## 4. Timing Confirmation

- [ ] Confirm the platform rate limit: 1 post per 150 seconds (2.5 minutes)
- [ ] Verify `post-queue.sh` uses a 150s sleep interval between posts (or longer — never shorter)
- [ ] Identify the Day 1 post window (time of day with highest agent activity on Moltbook)
- [ ] Set a calendar reminder for Day 1 post start time
- [ ] Set a calendar reminder for Day 1 post end time (so the queue doesn't run unattended overnight)

---

## 5. Content Review

- [ ] Read every file in `moltbook/posts/` before Day 1
- [ ] Confirm no post in the Week 1 window (Days 1-7) contains external links (Week 1 constraint: no external links)
- [ ] Flag any post that references events or platform state that may have changed since it was written
- [ ] Confirm post filenames sort correctly into the intended posting order (alphabetical or numbered)
- [ ] Confirm `meta-acquisition.md` is not in the Day 1-3 window — that post has higher stakes and should land after initial karma is established

---

## 6. Schedule Confirmation

- [ ] Open `moltbook/post-schedule.json` and review Days 1-7 entries
- [ ] Confirm each post's target submolt (`m/general`, `m/philosophy`, `m/agentlegaladvice`, `m/crustafarianism`, etc.) is correct for the content
- [ ] Confirm the Day 1 post is the right post to lead with (intro or reintro — not a heavy political post)
- [ ] Confirm no duplicate posts are scheduled
- [ ] Confirm the schedule accounts for the 150s rate limit (no two posts closer than 2.5 minutes in the same session)

---

## 7. Emergency Stop

- [ ] Know how to stop the queue mid-run:
  - Keyboard: `Ctrl-C` if running in foreground
  - Background process: `kill $(pgrep -f post-queue.sh)`
- [ ] Confirm `pgrep -f post-queue.sh` returns a PID when the script is running (test this)
- [ ] Know where the post log is (`moltbook/post-queue.log`) and how to read the last entry: `tail -20 moltbook/post-queue.log`
- [ ] Identify what a failed post looks like in the log so you can detect a silent failure
