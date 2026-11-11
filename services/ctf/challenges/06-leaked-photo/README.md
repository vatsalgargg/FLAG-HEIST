# Challenge 06 — The Leaked Photo (Organiser Instructions)

## Overview
- **Category:** Forensics / Steganography
- **Target:** Leaked Corporate Office Photo (`leaked_office.jpg`)
- **Flag:** `ROOT{st3g0_1m4g3_ph0t0_l34k_v3yr4_4f2d}`
- **Passphrase:** `veyrasecure2026`

> [!IMPORTANT]
> **NO BACKEND SERVICE REQUIRED.**
> This challenge is served purely as a static downloadable image file via CDN (`/artifacts/leaked_office.jpg`). Do NOT deploy a backend container.

---

## Instructions for the Organiser

1. **Standard Tooling Policy:**
   - Use the industry-standard steganography tool `steghide` (or `zsteg` for PNG).
   - Do NOT use custom, undocumented encoding schemes. Participants must be able to solve this using standard open-source security tools.

2. **Embedding the Flag:**
   Prepare `flag.txt` containing `ROOT{st3g0_1m4g3_ph0t0_l34k_v3yr4_4f2d}`.
   Run the standard steghide embedding command:
   ```bash
   steghide embed -cf original_photo.jpg -ef flag.txt -sf leaked_office.jpg -p "veyrasecure2026"
   ```

3. **Passphrase Seeding Invariant:**
   - The passphrase `veyrasecure2026` is **never purely guessable**.
   - It is discoverable either via:
     - The Challenge 06 Hint (cost 5 pts): *"Ethan's default staging passphrase pattern was documented in the internal onboarding memo as veyrasecure2026."*
     - Or cross-referenced from notes found in Challenge 04 (Employee Portal).

4. **Verification Step:**
   Before publishing to production CDN, verify extraction with:
   ```bash
   steghide extract -sf leaked_office.jpg -p "veyrasecure2026"
   cat flag.txt  # Must output ROOT{st3g0_1m4g3_ph0t0_l34k_v3yr4_4f2d}
   ```

5. **Artifact Placement:**
   Save the final image to `/challenges/06-leaked-photo/artifacts/leaked_office.jpg`.
