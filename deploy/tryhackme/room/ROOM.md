# Flag Heist: The Veyra Breach

**Room description (short):** Retrace a full breach of Veyra Cloud Solutions — from a forgotten staging site to the final admin cover-up — across 13 web, crypto, OSINT and forensics tasks.

**Difficulty:** Medium · **Estimated time:** 180 min · **Tags:** web, osint, crypto, forensics, ssrf, idor

---

## Task 0 — Introduction (no answer needed, or use a "No answer needed" question)

Veyra Cloud Solutions was breached. Your job is to retrace every step the attacker took.

**Start the machine** and wait about 3 minutes for all services to boot. Then open the **mission console**:

`http://MACHINE_IP`

Log in with:
- Email: `operator@veyra.thm`
- Password: `HeistOperator2026`

The console lists every target, the downloadable evidence, and — for the last two tasks — your personal callback URL and callback log.

| Task | Where |
|---|---|
| 1. The Forgotten Staging Site | `http://MACHINE_IP:3101` |
| 2. The Broken Lock | download from the mission console (`http://MACHINE_IP`) → Task 2 |
| 3. The Twitter Trail | `http://MACHINE_IP:3103` |
| 4. The Employee Portal | `http://MACHINE_IP:3104` |
| 5. Who Is Ethan Cole? | `http://MACHINE_IP:3105` |
| 6. The Leaked Photo | download from the mission console (`http://MACHINE_IP`) → Task 6 |
| 7. The Invoice Trail | `http://MACHINE_IP:3107` — login `priya.nair` / `Veyra#Audit26` |
| 8. The Internal Dashboard | `http://MACHINE_IP:3107` — same account as Task 7. Client bundle: mission console → Task 8 |
| 9. The Session Bug | `http://MACHINE_IP:3109` |
| 10. The Config Backup | `http://MACHINE_IP:3110` |
| 11. The Debug Trace | download from the mission console (`http://MACHINE_IP`) → Task 11 |
| 12. The Diagnostics Backdoor | `http://MACHINE_IP:3112` — your callback URL and log are shown in the mission console → Task 12 |
| 13. The Admin Cover-Up | `http://MACHINE_IP:3113` — your callback URL and log are shown in the mission console → Task 13 |

**Rules of engagement:** attack only the ports listed above. The mission console itself (port 80) and SSH are out of scope.

All answers are flags in the format `ROOT{...}`.

---

## Task 1 — The Forgotten Staging Site

*The attacker's entry point — a staging environment nobody decommissioned.*

Our forensics team found the attacker's first move. Veyra Cloud Solutions had a staging environment that was never taken down. It's still live. Find what was left behind.

A clean Veyra site sits in front of you. No visible links, no obvious clues. But web servers often tell crawlers more than they tell humans. Start with what the server publicly declares.

Target: `http://MACHINE_IP:3101`

**Question:** What is the flag for "The Forgotten Staging Site"?
**Answer format:** `ROOT{...}`
**Hint (paste into the question's hint field):** Web crawlers follow rules. Where are those rules written?

_Extra hints from the original event (optional, e.g. in the task text):_
- Check /robots.txt — it might disallow more than you'd expect.

---

## Task 2 — The Broken Lock

*An internal message locked with RSA — and the lock was weaker than Veyra believed.*

During the breach investigation, a recovered internal message was found encrypted with RSA. Veyra assumed publishing the public key was harmless. They were wrong.

You have the public key and the ciphertext. The encryption uses RSA, but something about the key isn't right. Judge whether the key can really be trusted, then recover the message.

Files: download from the mission console (`http://MACHINE_IP`) → Task 2

**Question:** What is the flag for "The Broken Lock"?
**Answer format:** `ROOT{...}`
**Hint (paste into the question's hint field):** A public key is meant to be public. The real question is whether its numbers are strong enough.

_Extra hints from the original event (optional, e.g. in the task text):_
- The modulus is just two primes multiplied together. How hard is it to get them back?
- Once you have the factors, you can work out Euler's totient, and from there the private exponent.

---

## Task 3 — The Twitter Trail

*The attacker studied an employee's public Twitter profile before targeting him.*

The attacker didn't start with code — they started with people. A Veyra employee named Ethan Cole left breadcrumbs on his public Twitter. The attacker followed them.

Open Ethan Cole's public profile (@ethancole_ops7). Read everything — the bio, every post, every reply. The flag is hiding in one detail you might scroll past.

Target: `http://MACHINE_IP:3103`

**Question:** What is the flag for "The Twitter Trail"?
**Answer format:** `ROOT{...}`
**Hint (paste into the question's hint field):** Read every piece of text on the profile. Bios, posts, replies — all of it.

_Extra hints from the original event (optional, e.g. in the task text):_
- Have you checked alt text on images?

---

## Task 4 — The Employee Portal

*The attacker's first real foothold — a hidden portal protected by a default login.*

Somewhere on the Veyra site, there's a hidden login page — an employee portal that was never meant to be public. The credentials protecting it were never changed from the default.

The target site has no visible login link. But hidden paths exist if you know where to look. Find the portal, get in, and retrieve what's behind it.

Target: `http://MACHINE_IP:3104`

**Question:** What is the flag for "The Employee Portal"?
**Answer format:** `ROOT{...}`
**Hint (paste into the question's hint field):** Common wordlists know common paths. Tools like gobuster, dirb, or ffuf can help.

_Extra hints from the original event (optional, e.g. in the task text):_
- Default credentials are a classic first guess. Think admin/admin123.

---

## Task 5 — Who Is Ethan Cole?

*A password hash tied to Ethan Cole's account — left there on purpose.*

Investigators dug deeper into Ethan Cole. A password hash tied to his account turned up in Veyra's internal records — left there deliberately, showing he was working from the inside.

Veyra has an internal 'search our records' feature. Normal searches return normal results. But what happens when you break the search? Find the hidden record, crack the hash, submit the flag.

Target: `http://MACHINE_IP:3105`

**Question:** What is the flag for "Who Is Ethan Cole?"?
**Answer format:** `ROOT{...}`
**Hint (paste into the question's hint field):** Search queries have syntax. What happens when you leave a quote unclosed?

_Extra hints from the original event (optional, e.g. in the task text):_
- The hash is short and common. CrackStation or hashcat can handle it.

---

## Task 6 — The Leaked Photo

*A photo posted during the investigation hides more than it shows.*

A photo surfaced during the breach investigation — shared as evidence in the incident timeline. But the image carries more data than what's visible to the eye.

Download the evidence image. What you see isn't all there is. Standard steganography tools can reveal what's embedded inside — but they may ask for a passphrase. Veyra staff reuse secrets: something you have already seen in this breach may unlock it.

Files: download from the mission console (`http://MACHINE_IP`) → Task 6

**Question:** What is the flag for "The Leaked Photo"?
**Answer format:** `ROOT{...}`
**Hint (paste into the question's hint field):** Tools like steghide, zsteg, or binwalk can detect hidden data in images.

_Extra hints from the original event (optional, e.g. in the task text):_
- If the tool asks for a passphrase, look for it in another challenge or try common ones.

---

## Task 7 — The Invoice Trail

*The attacker pivoted into billing — but the account numbering wasn't simple.*

The attacker gained access to Veyra's billing system. Invoice IDs aren't sequential — they're derived from customer IDs through an undocumented transform. But the endpoint doesn't check ownership.

Log in with the provided account (priya.nair / Veyra#Audit26). Study your own invoice IDs and your customer ID. Reverse the pattern, find another customer's invoice, and access it.

Target: `http://MACHINE_IP:3107` — login `priya.nair` / `Veyra#Audit26`

**Question:** What is the flag for "The Invoice Trail"?
**Answer format:** `ROOT{...}`
**Hint (paste into the question's hint field):** Collect several of your own invoice IDs alongside your customer ID. Look for a mathematical relationship.

_Extra hints from the original event (optional, e.g. in the task text):_
- Check other pages in the app for clues about a second customer ID.
- The invoice endpoint checks your session but not whether the invoice belongs to you.

---

## Task 8 — The Internal Dashboard

*A reporting page never meant to be reached without the right role.*

The attacker found an internal reporting dashboard that was supposed to be restricted to admins. The obvious admin routes are properly locked — but one secondary route was overlooked.

Log in with the provided account. The admin dashboard blocks you. But the application's bundled frontend code reveals every route that exists — including ones the UI doesn't link to. Find the one that forgot its permission check.

Target: `http://MACHINE_IP:3107` — same account as Task 7. Client bundle: mission console → Task 8

**Question:** What is the flag for "The Internal Dashboard"?
**Answer format:** `ROOT{...}`
**Hint (paste into the question's hint field):** Retrieve the minified/bundled JavaScript and look for route definitions.

_Extra hints from the original event (optional, e.g. in the task text):_
- Most routes check permissions. One doesn't. It's not the obvious admin endpoint.

---

## Task 9 — The Session Bug

*A session mechanism that trusts the client too much.*

Veyra's legacy session system uses a cookie with a role value and a short checksum. Change the role and the checksum breaks. But the checksum scheme itself is weak enough to reverse-engineer.

Log in and inspect your session cookie. It contains a role and a checksum. Study how the checksum relates to the role. Forge a cookie with role=admin and a valid checksum.

Target: `http://MACHINE_IP:3109`

**Question:** What is the flag for "The Session Bug"?
**Answer format:** `ROOT{...}`
**Hint (paste into the question's hint field):** The cookie is encoded. Decode it first to see the structure.

_Extra hints from the original event (optional, e.g. in the task text):_
- Log in multiple times and compare cookies. The checksum scheme is consistent and simple.
- Once you understand the scheme, compute a valid checksum for role=admin.

---

## Task 10 — The Config Backup

*A leftover export feature that reads more than it should.*

A log-export feature on the Veyra site lets you download files by name. The obvious directory traversal is blocked — the filter rejects '../' literally. But filters that don't normalise have blind spots.

Find the download feature. Try a basic path traversal — it'll be blocked. Study what the filter actually checks versus what the filesystem actually interprets. Bypass it, find the config backup, then follow the trail to the flag.

Target: `http://MACHINE_IP:3110`

**Question:** What is the flag for "The Config Backup"?
**Answer format:** `ROOT{...}`
**Hint (paste into the question's hint field):** The filter blocks the obvious form — but 'obvious' and 'complete' aren't the same thing.

_Extra hints from the original event (optional, e.g. in the task text):_
- How the filter checks your input and how the filesystem interprets it may differ. Try encoding.
- The backup file isn't the end of the trail — read what it actually contains.

---

## Task 11 — The Debug Trace

*A page in debug mode quietly leaks more than an error.*

Several Veyra services left debug logging enabled after the incident. Each service logs with its own timestamp format and clock offset. One critical event sequence is scattered across all of them.

Download logs from multiple services. They use different timestamp formats and their clocks are offset. Correlate entries across services by request ID and adjusted timestamps to reconstruct the real event sequence. It leads to the flag.

Files: download from the mission console (`http://MACHINE_IP`) → Task 11

**Question:** What is the flag for "The Debug Trace"?
**Answer format:** `ROOT{...}`
**Hint (paste into the question's hint field):** This isn't one log — it's several, and they don't agree on what time it is.

_Extra hints from the original event (optional, e.g. in the task text):_
- Find the fixed offset between services before you try to line anything up.
- A single request ID should let you follow one event across every service it touched.

---

## Task 12 — The Diagnostics Backdoor

*A leftover network tool that doesn't show its work.*

The attacker left a diagnostics tool running — one that checks the status of internal services. It accepts a hostname, runs a check, and always returns the same generic response. It never echoes what actually happened.

The tool always says 'check complete' regardless of input. You can't see command output directly. But if you can make the server talk to something you control, you don't need it to talk back to you. Use the event collaborator endpoint to exfiltrate data blind.

Target: `http://MACHINE_IP:3112` — your callback URL and log are shown in the mission console → Task 12

**Question:** What is the flag for "The Diagnostics Backdoor"?
**Answer format:** `ROOT{...}`
**Hint (paste into the question's hint field):** The tool never tells you what happened — so you'll need another way to find out.

_Extra hints from the original event (optional, e.g. in the task text):_
- If you can make this server talk to something you control, you don't need it to talk back to you directly.
- The collaborator log says more than the tool's response ever will.

---

## Task 13 — The Admin Cover-Up

*The real incident report — locked behind one last system, unreachable directly.*

The final piece: who signed off on ignoring the staging site? The answer is in an admin report, but it's behind internal services that aren't directly reachable. A 'Link Preview' feature on the public site is your only way in — and it has a filter to get past first.

The Link Preview feature blocks obvious internal addresses. Bypass the filter, discover internal services through a chain of requests, obtain a token via blind callback, extract an API key, and use it to reach the admin endpoint holding the flag. Five steps, no shortcuts.

Target: `http://MACHINE_IP:3113` — your callback URL and log are shown in the mission console → Task 13

**Question:** What is the flag for "The Admin Cover-Up"?
**Answer format:** `ROOT{...}`
**Hint (paste into the question's hint field):** The filter only checks where your link points first — not where the server ends up after following it. Look for anything on the public site that sends you somewhere else.

_Extra hints from the original event (optional, e.g. in the task text):_
- The first internal service you reach isn't the one with the flag — it tells you where to go next.
- You'll need the collaborator endpoint again. The second internal service requires a token from a callback.
- The API key from the second service unlocks a third, separate admin endpoint.
