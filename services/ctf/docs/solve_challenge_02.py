#!/usr/bin/env python3
"""
Private Solution Script for Challenge 02 — The Broken Lock
(Kept strictly in /docs for organizers; never served publicly)

Factors n using Pollard's rho algorithm, derives the private exponent d,
and recovers the decrypted flag.
"""

import time
import math
import os

def pollards_rho(n):
    """
    Pollard's rho integer factorization algorithm.
    Time complexity O(sqrt(min(p, q))).
    """
    if n % 2 == 0:
        return 2
    x = 2
    y = 2
    d = 1
    c = 1
    f = lambda val: (val * val + c) % n

    while d == 1:
        x = f(x)
        y = f(f(y))
        d = math.gcd(abs(x - y), n)
        if d == n:
            c += 1
            x = 2
            y = 2
            d = 1
    return d

def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    pub_file = os.path.join(repo_root, "challenges", "02-broken-lock", "artifacts", "public_key.txt")
    cipher_file = os.path.join(repo_root, "challenges", "02-broken-lock", "artifacts", "ciphertext.txt")

    # Read public key
    with open(pub_file, "r") as f:
        lines = f.read().splitlines()
        n = int(lines[2].strip())
        e = int(lines[5].strip())

    # Read ciphertext
    with open(cipher_file, "r") as f:
        lines = f.read().splitlines()
        c = int(lines[2].strip())

    print(f"[*] Solving Challenge 02...")
    print(f"[*] Modulus n ({n.bit_length()} bits): {n}")
    print(f"[*] Exponent e: {e}")
    print(f"[*] Running Pollard's rho factorization against n...")

    start_time = time.time()
    p = pollards_rho(n)
    elapsed = time.time() - start_time

    q = n // p
    assert p * q == n, "Factorization verification failed!"

    print(f"[+] Factoring successful in {elapsed:.2f} seconds!")
    print(f"[+] p = {p} ({p.bit_length()} bits)")
    print(f"[+] q = {q} ({q.bit_length()} bits)")

    # Compute private exponent d = e^-1 mod phi
    phi = (p - 1) * (q - 1)
    d = pow(e, -1, phi)

    # Decrypt m = c^d mod n
    m = pow(c, d, n)
    flag_bytes = m.to_bytes((m.bit_length() + 7) // 8, byteorder="big")
    flag = flag_bytes.decode("utf-8")

    print(f"[+] Recovered Flag: {flag}")
    return flag

if __name__ == "__main__":
    main()
