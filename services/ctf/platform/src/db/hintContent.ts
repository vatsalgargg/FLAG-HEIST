// Original arena hints, kept server-side so unrevealed content never enters a browser bundle.
export const INITIAL_HINTS = [
  {
    "challengeId": 1,
    "displayOrder": 1,
    "cost": 3,
    "content": "Web crawlers follow rules. Where are those rules written?"
  },
  {
    "challengeId": 1,
    "displayOrder": 2,
    "cost": 5,
    "content": "Check /robots.txt — it might disallow more than you'd expect."
  },
  {
    "challengeId": 2,
    "displayOrder": 1,
    "cost": 3,
    "content": "A public key is meant to be public. The real question is whether its numbers are strong enough."
  },
  {
    "challengeId": 2,
    "displayOrder": 2,
    "cost": 3,
    "content": "The modulus is just two primes multiplied together. How hard is it to get them back?"
  },
  {
    "challengeId": 2,
    "displayOrder": 3,
    "cost": 5,
    "content": "Once you have the factors, you can work out Euler's totient, and from there the private exponent."
  },
  {
    "challengeId": 3,
    "displayOrder": 1,
    "cost": 3,
    "content": "Read every piece of text on the profile. Bios, posts, replies — all of it."
  },
  {
    "challengeId": 3,
    "displayOrder": 2,
    "cost": 5,
    "content": "Have you checked alt text on images?"
  },
  {
    "challengeId": 4,
    "displayOrder": 1,
    "cost": 3,
    "content": "Common wordlists know common paths. Tools like gobuster, dirb, or ffuf can help."
  },
  {
    "challengeId": 4,
    "displayOrder": 2,
    "cost": 5,
    "content": "Default credentials are a classic first guess. Think admin/admin123."
  },
  {
    "challengeId": 5,
    "displayOrder": 1,
    "cost": 3,
    "content": "Search queries have syntax. What happens when you leave a quote unclosed?"
  },
  {
    "challengeId": 5,
    "displayOrder": 2,
    "cost": 5,
    "content": "The hash is short and common. CrackStation or hashcat can handle it."
  },
  {
    "challengeId": 6,
    "displayOrder": 1,
    "cost": 3,
    "content": "Tools like steghide, zsteg, or binwalk can detect hidden data in images."
  },
  {
    "challengeId": 6,
    "displayOrder": 2,
    "cost": 5,
    "content": "If the tool asks for a passphrase, look for it in another challenge or try common ones."
  },
  {
    "challengeId": 7,
    "displayOrder": 1,
    "cost": 3,
    "content": "Collect several of your own invoice IDs alongside your customer ID. Look for a mathematical relationship."
  },
  {
    "challengeId": 7,
    "displayOrder": 2,
    "cost": 3,
    "content": "Check other pages in the app for clues about a second customer ID."
  },
  {
    "challengeId": 7,
    "displayOrder": 3,
    "cost": 5,
    "content": "The invoice endpoint checks your session but not whether the invoice belongs to you."
  },
  {
    "challengeId": 8,
    "displayOrder": 1,
    "cost": 3,
    "content": "Retrieve the minified/bundled JavaScript and look for route definitions."
  },
  {
    "challengeId": 8,
    "displayOrder": 2,
    "cost": 5,
    "content": "Most routes check permissions. One doesn't. It's not the obvious admin endpoint."
  },
  {
    "challengeId": 9,
    "displayOrder": 1,
    "cost": 3,
    "content": "The cookie is encoded. Decode it first to see the structure."
  },
  {
    "challengeId": 9,
    "displayOrder": 2,
    "cost": 3,
    "content": "Log in multiple times and compare cookies. The checksum scheme is consistent and simple."
  },
  {
    "challengeId": 9,
    "displayOrder": 3,
    "cost": 5,
    "content": "Once you understand the scheme, compute a valid checksum for role=admin."
  },
  {
    "challengeId": 10,
    "displayOrder": 1,
    "cost": 3,
    "content": "The filter blocks the obvious form — but 'obvious' and 'complete' aren't the same thing."
  },
  {
    "challengeId": 10,
    "displayOrder": 2,
    "cost": 3,
    "content": "How the filter checks your input and how the filesystem interprets it may differ. Try encoding."
  },
  {
    "challengeId": 10,
    "displayOrder": 3,
    "cost": 5,
    "content": "The backup file isn't the end of the trail — read what it actually contains."
  },
  {
    "challengeId": 11,
    "displayOrder": 1,
    "cost": 3,
    "content": "This isn't one log — it's several, and they don't agree on what time it is."
  },
  {
    "challengeId": 11,
    "displayOrder": 2,
    "cost": 3,
    "content": "Find the fixed offset between services before you try to line anything up."
  },
  {
    "challengeId": 11,
    "displayOrder": 3,
    "cost": 5,
    "content": "A single request ID should let you follow one event across every service it touched."
  },
  {
    "challengeId": 12,
    "displayOrder": 1,
    "cost": 3,
    "content": "The tool never tells you what happened — so you'll need another way to find out."
  },
  {
    "challengeId": 12,
    "displayOrder": 2,
    "cost": 3,
    "content": "If you can make this server talk to something you control, you don't need it to talk back to you directly."
  },
  {
    "challengeId": 12,
    "displayOrder": 3,
    "cost": 5,
    "content": "The collaborator log says more than the tool's response ever will."
  },
  {
    "challengeId": 13,
    "displayOrder": 1,
    "cost": 3,
    "content": "The filter only checks where your link points first — not where the server ends up after following it. Look for anything on the public site that sends you somewhere else."
  },
  {
    "challengeId": 13,
    "displayOrder": 2,
    "cost": 3,
    "content": "The first internal service you reach isn't the one with the flag — it tells you where to go next."
  },
  {
    "challengeId": 13,
    "displayOrder": 3,
    "cost": 5,
    "content": "You'll need the collaborator endpoint again. The second internal service requires a token from a callback."
  },
  {
    "challengeId": 13,
    "displayOrder": 4,
    "cost": 5,
    "content": "The API key from the second service unlocks a third, separate admin endpoint."
  }
];
