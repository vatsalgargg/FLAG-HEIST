export interface ChallengeHint {
  id?: string;
  text: string;
  cost: number;
}

export interface Challenge {
  id: number;
  title: string;
  storyBeat: string;
  points: number;
  narrative: string;
  briefing: string;
  hints: ChallengeHint[];
}

export const challenges: Challenge[] = [
  {
    id: 1,
    title: "The Forgotten Staging Site",
    storyBeat: "The attacker's entry point — a staging environment nobody decommissioned.",
    points: 15,
    narrative:
      "Our forensics team found the attacker's first move. Veyra Cloud Solutions had a staging environment that was never taken down. It's still live. Find what was left behind.",
    briefing:
      "A clean Veyra site sits in front of you. No visible links, no obvious clues. But web servers often tell crawlers more than they tell humans. Start with what the server publicly declares.",
    hints: [
      { cost: 3, text: "Web crawlers follow rules. Where are those rules written?" },
      { cost: 5, text: "Check /robots.txt — it might disallow more than you'd expect." },
    ],
  },
  {
    id: 2,
    title: "The Broken Lock",
    storyBeat: "An internal message locked with RSA — and the lock was weaker than Veyra believed.",
    points: 15,
    narrative:
      "During the breach investigation, a recovered internal message was found encrypted with RSA. Veyra assumed publishing the public key was harmless. They were wrong.",
    briefing:
      "You have the public key and the ciphertext. The encryption uses RSA, but something about the key isn't right. Judge whether the key can really be trusted, then recover the message.",
    hints: [
      {
        cost: 3,
        text: "A public key is meant to be public. The real question is whether its numbers are strong enough.",
      },
      {
        cost: 3,
        text: "The modulus is just two primes multiplied together. How hard is it to get them back?",
      },
      {
        cost: 5,
        text: "Once you have the factors, you can work out Euler's totient, and from there the private exponent.",
      },
    ],
  },
  {
    id: 3,
    title: "The Twitter Trail",
    storyBeat: "The attacker studied an employee's public Twitter profile before targeting him.",
    points: 15,
    narrative:
      "The attacker didn't start with code — they started with people. A Veyra employee named Ethan Cole left breadcrumbs on his public Twitter. The attacker followed them.",
    briefing:
      "Open Ethan Cole's public profile (@ethancole_ops7). Read everything — the bio, every post, every reply. The flag is hiding in one detail you might scroll past.",
    hints: [
      { cost: 3, text: "Read every piece of text on the profile. Bios, posts, replies — all of it." },
      { cost: 5, text: "Have you checked alt text on images?" },
    ],
  },
  {
    id: 4,
    title: "The Employee Portal",
    storyBeat: "The attacker's first real foothold — a hidden portal protected by a default login.",
    points: 15,
    narrative:
      "Somewhere on the Veyra site, there's a hidden login page — an employee portal that was never meant to be public. The credentials protecting it were never changed from the default.",
    briefing:
      "The target site has no visible login link. But hidden paths exist if you know where to look. Find the portal, get in, and retrieve what's behind it.",
    hints: [
      {
        cost: 3,
        text: "Common wordlists know common paths. Tools like gobuster, dirb, or ffuf can help.",
      },
      { cost: 5, text: "Default credentials are a classic first guess. Think admin/admin123." },
    ],
  },
  {
    id: 5,
    title: "Who Is Ethan Cole?",
    storyBeat: "A password hash tied to Ethan Cole's account — left there on purpose.",
    points: 15,
    narrative:
      "Investigators dug deeper into Ethan Cole. A password hash tied to his account turned up in Veyra's internal records — left there deliberately, showing he was working from the inside.",
    briefing:
      "Veyra has an internal 'search our records' feature. Normal searches return normal results. But what happens when you break the search? Find the hidden record, crack the hash, submit the flag.",
    hints: [
      { cost: 3, text: "Search queries have syntax. What happens when you leave a quote unclosed?" },
      { cost: 5, text: "The hash is short and common. CrackStation or hashcat can handle it." },
    ],
  },
  {
    id: 6,
    title: "The Leaked Photo",
    storyBeat: "A photo posted during the investigation hides more than it shows.",
    points: 15,
    narrative:
      "A photo surfaced during the breach investigation — shared as evidence in the incident timeline. But the image carries more data than what's visible to the eye.",
    briefing:
      "Download the evidence image. What you see isn't all there is. Standard steganography tools can reveal what's embedded inside. Extract the hidden data.",
    hints: [
      { cost: 3, text: "Tools like steghide, zsteg, or binwalk can detect hidden data in images." },
      {
        cost: 5,
        text: "If the tool asks for a passphrase, look for it in another challenge or try common ones.",
      },
    ],
  },
  {
    id: 7,
    title: "The Invoice Trail",
    storyBeat: "The attacker pivoted into billing — but the account numbering wasn't simple.",
    points: 15,
    narrative:
      "The attacker gained access to Veyra's billing system. Invoice IDs aren't sequential — they're derived from customer IDs through an undocumented transform. But the endpoint doesn't check ownership.",
    briefing:
      "Log in with the provided account (priya.nair / Veyra#Audit26). Study your own invoice IDs and your customer ID. Reverse the pattern, find another customer's invoice, and access it.",
    hints: [
      {
        cost: 3,
        text: "Collect several of your own invoice IDs alongside your customer ID. Look for a mathematical relationship.",
      },
      { cost: 3, text: "Check other pages in the app for clues about a second customer ID." },
      { cost: 5, text: "The invoice endpoint checks your session but not whether the invoice belongs to you." },
    ],
  },
  {
    id: 8,
    title: "The Internal Dashboard",
    storyBeat: "A reporting page never meant to be reached without the right role.",
    points: 15,
    narrative:
      "The attacker found an internal reporting dashboard that was supposed to be restricted to admins. The obvious admin routes are properly locked — but one secondary route was overlooked.",
    briefing:
      "Log in with the provided account. The admin dashboard blocks you. But the application's bundled frontend code reveals every route that exists — including ones the UI doesn't link to. Find the one that forgot its permission check.",
    hints: [
      { cost: 3, text: "Retrieve the minified/bundled JavaScript and look for route definitions." },
      {
        cost: 5,
        text: "Most routes check permissions. One doesn't. It's not the obvious admin endpoint.",
      },
    ],
  },
  {
    id: 9,
    title: "The Session Bug",
    storyBeat: "A session mechanism that trusts the client too much.",
    points: 15,
    narrative:
      "Veyra's legacy session system uses a cookie with a role value and a short checksum. Change the role and the checksum breaks. But the checksum scheme itself is weak enough to reverse-engineer.",
    briefing:
      "Log in and inspect your session cookie. It contains a role and a checksum. Study how the checksum relates to the role. Forge a cookie with role=admin and a valid checksum.",
    hints: [
      { cost: 3, text: "The cookie is encoded. Decode it first to see the structure." },
      {
        cost: 3,
        text: "Log in multiple times and compare cookies. The checksum scheme is consistent and simple.",
      },
      { cost: 5, text: "Once you understand the scheme, compute a valid checksum for role=admin." },
    ],
  },
  {
    id: 10,
    title: "The Config Backup",
    storyBeat: "A leftover export feature that reads more than it should.",
    points: 15,
    narrative:
      "A log-export feature on the Veyra site lets you download files by name. The obvious directory traversal is blocked — the filter rejects '../' literally. But filters that don't normalise have blind spots.",
    briefing:
      "Find the download feature. Try a basic path traversal — it'll be blocked. Study what the filter actually checks versus what the filesystem actually interprets. Bypass it, find the config backup, then follow the trail to the flag.",
    hints: [
      {
        cost: 3,
        text: "The filter blocks the obvious form — but 'obvious' and 'complete' aren't the same thing.",
      },
      {
        cost: 3,
        text: "How the filter checks your input and how the filesystem interprets it may differ. Try encoding.",
      },
      { cost: 5, text: "The backup file isn't the end of the trail — read what it actually contains." },
    ],
  },
  {
    id: 11,
    title: "The Debug Trace",
    storyBeat: "A page in debug mode quietly leaks more than an error.",
    points: 15,
    narrative:
      "Several Veyra services left debug logging enabled after the incident. Each service logs with its own timestamp format and clock offset. One critical event sequence is scattered across all of them.",
    briefing:
      "Download logs from multiple services. They use different timestamp formats and their clocks are offset. Correlate entries across services by request ID and adjusted timestamps to reconstruct the real event sequence. It leads to the flag.",
    hints: [
      { cost: 3, text: "This isn't one log — it's several, and they don't agree on what time it is." },
      { cost: 3, text: "Find the fixed offset between services before you try to line anything up." },
      {
        cost: 5,
        text: "A single request ID should let you follow one event across every service it touched.",
      },
    ],
  },
  {
    id: 12,
    title: "The Diagnostics Backdoor",
    storyBeat: "A leftover network tool that doesn't show its work.",
    points: 15,
    narrative:
      "The attacker left a diagnostics tool running — one that checks the status of internal services. It accepts a hostname, runs a check, and always returns the same generic response. It never echoes what actually happened.",
    briefing:
      "The tool always says 'check complete' regardless of input. You can't see command output directly. But if you can make the server talk to something you control, you don't need it to talk back to you. Use the event collaborator endpoint to exfiltrate data blind.",
    hints: [
      {
        cost: 3,
        text: "The tool never tells you what happened — so you'll need another way to find out.",
      },
      {
        cost: 3,
        text: "If you can make this server talk to something you control, you don't need it to talk back to you directly.",
      },
      { cost: 5, text: "The collaborator log says more than the tool's response ever will." },
    ],
  },
  {
    id: 13,
    title: "The Admin Cover-Up",
    storyBeat: "The real incident report — locked behind one last system, unreachable directly.",
    points: 20,
    narrative:
      "The final piece: who signed off on ignoring the staging site? The answer is in an admin report, but it's behind internal services that aren't directly reachable. A 'Link Preview' feature on the public site is your only way in — and it has a filter to get past first.",
    briefing:
      "The Link Preview feature blocks obvious internal addresses. Bypass the filter, discover internal services through a chain of requests, obtain a token via blind callback, extract an API key, and use it to reach the admin endpoint holding the flag. Five steps, no shortcuts.",
    hints: [
      {
        cost: 3,
        text: "The filter blocks literal internal addresses. But there are other ways to represent the same IP.",
      },
      {
        cost: 3,
        text: "The first internal service you reach isn't the one with the flag — it tells you where to go next.",
      },
      {
        cost: 5,
        text: "You'll need the collaborator endpoint again. The second internal service requires a token from a callback.",
      },
      { cost: 5, text: "The API key from the second service unlocks a third, separate admin endpoint." },
    ],
  },
];
