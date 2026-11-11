# Challenge 02 — The Broken Lock (Organiser Write-Up)

## Challenge Details
- **Challenge ID:** 2
- **Name:** The Broken Lock
- **Tier:** Intro
- **Points:** 15
- **Category:** Cryptography
- **Flag:** `ROOT{sm4ll_pr1m3_f4ct0r_8921}`

---

## Cryptographic Parameters & Mechanism
- **Public Modulus ($n$):**
  `97466741870863667870496008719537650140568999892629361986359994153291109281367831` (266 bits)
- **Public Exponent ($e$):** `65537`
- **Ciphertext ($c$):**
  `22602008956250789290051235457599366654696329737427901718094652920143394153964216`
- **Underlying Primes:**
  - $p = 68887534446191$ (46 bits)
  - $q = 1414867619438409130535182176167231937411718272669731132857506414041$ (220 bits)

### Empirical Verification of Factoring Time
- Standard Pollard's rho algorithm was empirically run against $n$ on a standard modern CPU.
- **Empirical factoring time:** **14.42 seconds** (average range 12–25 seconds across 5 test runs).
- Sizing invariant: $m = \text{int(flag)} = 231\text{ bits} < n = 266\text{ bits}$.

---

## Exact Triggering Input & Solution Steps

### Step 1: Download Artifacts
Download `public_key.txt` and `ciphertext.txt` from the challenge CDN links.

### Step 2: Factorize Modulus $n$
Execute Pollard's rho algorithm or standard tools (e.g. `factordb`, `msieve`, `yafu`, `sympy.factorint`) to find:
- $p = 68887534446191$
- $q = n / p = 1414867619438409130535182176167231937411718272669731132857506414041$

### Step 3: Compute Private Exponent $d$
$$\phi(n) = (p - 1)(q - 1)$$
$$d = e^{-1} \pmod{\phi(n)}$$

### Step 4: Decrypt Ciphertext
$$m = c^d \pmod n$$
Convert big integer $m$ to UTF-8 bytes to recover:
`ROOT{sm4ll_pr1m3_f4ct0r_8921}`

---

## Reset Procedure
- **Mechanism:** None.
- **Explanation:** Artifacts (`public_key.txt` and `ciphertext.txt`) are static files hosted on CDN. There is no server-side compute or mutable state to reset.
