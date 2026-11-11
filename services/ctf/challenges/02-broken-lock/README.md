# Challenge 02 — Broken Lock (RSA)

## Overview
- **Category:** Cryptography
- **Target:** Compromised Veyra RSA Public Key & Encrypted Ciphertext
- **Phase:** Phase C (Static / low-complexity challenges — Prompt 9)
- **Vulnerability Concept:** RSA key generated with standard exponent $e=65537$ but using two small, crackable prime factors ($p, q$). Participants factorize the modulus $N$ to reconstruct private key $d$ and decrypt `ciphertext.txt`.

## ARCHITECTURAL NOTE: NO BACKEND REQUIRED
> [!IMPORTANT]
> **This challenge does NOT need a backend service.**
> Do not scaffold or deploy a container or server for this challenge.
> It is generated once at build time using a verified cryptography library, validated, and frozen.
> The resulting `public_key.txt` and `ciphertext.txt` are hosted as static files on the CDN for participants to download.

## Assets Directory
- `/artifacts/`: Will contain `public_key.txt` and `ciphertext.txt`.
