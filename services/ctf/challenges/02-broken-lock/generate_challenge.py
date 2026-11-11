#!/usr/bin/env python3
"""
Challenge 02 — The Broken Lock (RSA Key & Ciphertext Generator)

CRYPTOGRAPHIC DESIGN:
=============================================================================
1. Standard Public Exponent: e = 65537 (0x10001).
2. Asymmetric Prime Sizing:
   - p is chosen as a 46-bit prime (~6.88e13).
   - q is chosen as a 220-bit prime (~1.41e66).
   - n = p * q is a 266-bit modulus.
3. Why this sizing:
   - The flag is converted directly to big-endian integer m (231 bits).
   - CRITICAL CONSTRAINT: m < n MUST hold (231 < 266 bits). If flag integer m >= n,
     RSA modular reduction m^e mod n silently corrupts decryption.
   - Factoring complexity: Pollard's rho algorithm has expected running time
     O(sqrt(min(p, q))) = O(sqrt(p)) ~ 2^23 operations. On an ordinary laptop,
     Pollard's rho factors this n in ~15-30 seconds. It is completely infeasible
     to factor by hand or via trial division, but quick and reliable with a standard script.
=============================================================================
"""

import os
import math
import sympy

FLAG = "ROOT{sm4ll_pr1m3_f4ct0r_8921}"

def main():
    # 1. Deterministic/Verified primes
    p = 68887534446191
    q = 1414867619438409130535182176167231937411718272669731132857506414041
    n = p * q
    e = 65537

    # Verify primality
    assert sympy.isprime(p), "p must be prime"
    assert sympy.isprime(q), "q must be prime"

    # Verify coprime with totient
    phi = (p - 1) * (q - 1)
    assert math.gcd(e, phi) == 1, "gcd(e, phi) must be 1"

    # 2. Encode flag as integer
    flag_bytes = FLAG.encode("utf-8")
    m = int.from_bytes(flag_bytes, byteorder="big")

    # CRITICAL: m < n assertion
    assert m < n, f"Flag integer m ({m.bit_length()} bits) must be smaller than modulus n ({n.bit_length()} bits)"

    # 3. Encrypt: c = m^e mod n
    c = pow(m, e, n)

    # 4. Verify decryption locally
    d = pow(e, -1, phi)
    decrypted_m = pow(c, d, n)
    decrypted_flag = decrypted_m.to_bytes((decrypted_m.bit_length() + 7) // 8, byteorder="big").decode("utf-8")
    assert decrypted_flag == FLAG, "Decryption verification failed!"

    # 5. Write artifacts
    artifacts_dir = os.path.join(os.path.dirname(__file__), "artifacts")
    os.makedirs(artifacts_dir, exist_ok=True)

    pub_path = os.path.join(artifacts_dir, "public_key.txt")
    with open(pub_path, "w") as f:
        f.write("----- VEYRA PRODUCTION RSA PUBLIC KEY -----\n")
        f.write(f"Modulus (n):\n{n}\n\n")
        f.write(f"Public Exponent (e):\n{e}\n")

    cipher_path = os.path.join(artifacts_dir, "ciphertext.txt")
    with open(cipher_path, "w") as f:
        f.write("----- ENCRYPTED FLAG CIPHERTEXT -----\n")
        f.write(f"Ciphertext (c):\n{c}\n")

    print("[SUCCESS] Challenge artifacts generated:")
    print(f"  Public Key: {pub_path}")
    print(f"  Ciphertext: {cipher_path}")
    print(f"  Modulus n bit length: {n.bit_length()} bits")
    print(f"  Flag: {FLAG}")

if __name__ == "__main__":
    main()
