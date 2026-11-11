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
  tier: "Intro" | "Progressive" | "Final";
  narrative: string;
  briefing: string;
  hints: ChallengeHint[];
  providedAssets?: { label: string; href: string }[];
}

export const challenges: Challenge[] = [
  {
    id: 1,
    title: "The Forgotten Staging Site",
    storyBeat: "The attacker's entry point — a staging environment nobody decommissioned.",
    points: 15,
    tier: "Intro",
    narrative:
      "Our forensics team found the attacker's first move. Veyra Cloud Solutions had a staging environment that was never taken down. It's still live. Find what was left behind.",
    briefing:
      "A clean Veyra site sits in front of you. No visible links, no obvious clues. But web servers often tell crawlers more than they tell humans. Start with what the server publicly declares.",
    hints: [],
  },
  {
    id: 2,
    title: "The Broken Lock",
    storyBeat: "An internal message locked with RSA — and the lock was weaker than Veyra believed.",
    points: 15,
    tier: "Intro",
    narrative:
      "During the breach investigation, a recovered internal message was found encrypted with RSA. Veyra assumed publishing the public key was harmless. They were wrong.",
    briefing:
      "You have the public key and the ciphertext. The encryption uses RSA, but something about the key isn't right. Judge whether the key can really be trusted, then recover the message.",
    hints: [],
    providedAssets: [
      { label: "public_key.txt", href: "/artifacts/ch02/public_key.txt" },
      { label: "ciphertext.txt", href: "/artifacts/ch02/ciphertext.txt" },
    ],
  },
  {
    id: 3,
    title: "The Twitter Trail",
    storyBeat: "The attacker studied an employee's public Twitter profile before targeting him.",
    points: 15,
    tier: "Intro",
    narrative:
      "The attacker didn't start with code — they started with people. A Veyra employee named Ethan Cole left breadcrumbs on his public Twitter. The attacker followed them.",
    briefing:
      "Open Ethan Cole's public profile (@ethancole_ops7). Read everything — the bio, every post, every reply. The flag is hiding in one detail you might scroll past.",
    hints: [],
  },
  {
    id: 4,
    title: "The Employee Portal",
    storyBeat: "The attacker's first real foothold — a hidden portal protected by a default login.",
    points: 15,
    tier: "Progressive",
    narrative:
      "Somewhere on the Veyra site, there's a hidden login page — an employee portal that was never meant to be public. The credentials protecting it were never changed from the default.",
    briefing:
      "The target site has no visible login link. But hidden paths exist if you know where to look. Find the portal, get in, and retrieve what's behind it.",
    hints: [],
  },
  {
    id: 5,
    title: "Who Is Ethan Cole?",
    storyBeat: "A password hash tied to Ethan Cole's account — left there on purpose.",
    points: 15,
    tier: "Progressive",
    narrative:
      "Investigators dug deeper into Ethan Cole. A password hash tied to his account turned up in Veyra's internal records — left there deliberately, showing he was working from the inside.",
    briefing:
      "Veyra has an internal 'search our records' feature. Normal searches return normal results. But what happens when you break the search? Find the hidden record, crack the hash, submit the flag.",
    hints: [],
  },
  {
    id: 6,
    title: "The Leaked Photo",
    storyBeat: "A photo posted during the investigation hides more than it shows.",
    points: 15,
    tier: "Progressive",
    narrative:
      "A photo surfaced during the breach investigation — shared as evidence in the incident timeline. But the image carries more data than what's visible to the eye.",
    briefing:
      "Download the evidence image. What you see isn't all there is. Standard steganography tools can reveal what's embedded inside — but they may ask for a passphrase. Veyra staff reuse secrets: something you have already seen in this breach may unlock it.",
    hints: [],
    providedAssets: [
      { label: "leaked_office.jpg", href: "/artifacts/ch06/leaked_office.jpg" },
    ],
  },
  {
    id: 7,
    title: "The Invoice Trail",
    storyBeat: "The attacker pivoted into billing — but the account numbering wasn't simple.",
    points: 15,
    tier: "Progressive",
    narrative:
      "The attacker gained access to Veyra's billing system. Invoice IDs aren't sequential — they're derived from customer IDs through an undocumented transform. But the endpoint doesn't check ownership.",
    briefing:
      "Log in with the provided account (priya.nair / Veyra#Audit26). Study your own invoice IDs and your customer ID. Reverse the pattern, find another customer's invoice, and access it.",
    hints: [],
  },
  {
    id: 8,
    providedAssets: [{ label: "Client release bundle", href: "/artifacts/ch08/veyra-frontend-portal-release.zip" }],
    title: "The Internal Dashboard",
    storyBeat: "A reporting page never meant to be reached without the right role.",
    points: 15,
    tier: "Progressive",
    narrative:
      "The attacker found an internal reporting dashboard that was supposed to be restricted to admins. The obvious admin routes are properly locked — but one secondary route was overlooked.",
    briefing:
      "Log in with the provided account. The admin dashboard blocks you. But the application's bundled frontend code reveals every route that exists — including ones the UI doesn't link to. Find the one that forgot its permission check.",
    hints: [],
  },
  {
    id: 9,
    title: "The Session Bug",
    storyBeat: "A session mechanism that trusts the client too much.",
    points: 15,
    tier: "Progressive",
    narrative:
      "Veyra's legacy session system uses a cookie with a role value and a short checksum. Change the role and the checksum breaks. But the checksum scheme itself is weak enough to reverse-engineer.",
    briefing:
      "Log in and inspect your session cookie. It contains a role and a checksum. Study how the checksum relates to the role. Forge a cookie with role=admin and a valid checksum.",
    hints: [],
  },
  {
    id: 10,
    title: "The Config Backup",
    storyBeat: "A leftover export feature that reads more than it should.",
    points: 15,
    tier: "Progressive",
    narrative:
      "A log-export feature on the Veyra site lets you download files by name. The obvious directory traversal is blocked — the filter rejects '../' literally. But filters that don't normalise have blind spots.",
    briefing:
      "Find the download feature. Try a basic path traversal — it'll be blocked. Study what the filter actually checks versus what the filesystem actually interprets. Bypass it, find the config backup, then follow the trail to the flag.",
    hints: [],
  },
  {
    id: 11,
    providedAssets: [
      { label: "svc-a.log", href: "/artifacts/ch11/svc-a.log" },
      { label: "gateway-7.log", href: "/artifacts/ch11/gateway-7.log" },
      { label: "proc-core.log", href: "/artifacts/ch11/proc-core.log" },
    ],
    title: "The Debug Trace",
    storyBeat: "A page in debug mode quietly leaks more than an error.",
    points: 15,
    tier: "Progressive",
    narrative:
      "Several Veyra services left debug logging enabled after the incident. Each service logs with its own timestamp format and clock offset. One critical event sequence is scattered across all of them.",
    briefing:
      "Download logs from multiple services. They use different timestamp formats and their clocks are offset. Correlate entries across services by request ID and adjusted timestamps to reconstruct the real event sequence. It leads to the flag.",
    hints: [],
  },
  {
    id: 12,
    title: "The Diagnostics Backdoor",
    storyBeat: "A leftover network tool that doesn't show its work.",
    points: 15,
    tier: "Progressive",
    narrative:
      "The attacker left a diagnostics tool running — one that checks the status of internal services. It accepts a hostname, runs a check, and always returns the same generic response. It never echoes what actually happened.",
    briefing:
      "The tool always says 'check complete' regardless of input. You can't see command output directly. But if you can make the server talk to something you control, you don't need it to talk back to you. Use the event collaborator endpoint to exfiltrate data blind.",
    hints: [],
  },
  {
    id: 13,
    title: "The Admin Cover-Up",
    storyBeat: "The real incident report — locked behind one last system, unreachable directly.",
    points: 20,
    tier: "Final",
    narrative:
      "The final piece: who signed off on ignoring the staging site? The answer is in an admin report, but it's behind internal services that aren't directly reachable. A 'Link Preview' feature on the public site is your only way in — and it has a filter to get past first.",
    briefing:
      "The Link Preview feature blocks obvious internal addresses. Bypass the filter, discover internal services through a chain of requests, obtain a token via blind callback, extract an API key, and use it to reach the admin endpoint holding the flag. Five steps, no shortcuts.",
    hints: [],
  },
];

