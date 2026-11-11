# Challenge 06 — The Leaked Photo (Organiser Write-Up)

## Challenge Details
- **Challenge ID:** 6
- **Name:** The Leaked Photo
- **Tier:** Progressive
- **Points:** 15
- **Category:** Forensics / Steganography
- **Flag:** `ROOT{st3g0_1m4g3_ph0t0_l34k_v3yr4_4f2d}`
- **Passphrase:** `veyrasecure2026`

---

## Tooling & Embedding Specification
- **Tool:** `steghide` (version 0.5.1+)
- **Source Artifact:** `leaked_office.jpg`
- **Passphrase Derivation:**
  Discovered from internal documentation / challenge hint (`veyrasecure2026`).

### Exact Embedding Command:
```bash
steghide embed -cf original_photo.jpg -ef flag.txt -sf leaked_office.jpg -p "veyrasecure2026"
```

---

## Exact Triggering Input & Solution Steps

### Step 1: Download Image Artifact
Participant downloads `leaked_office.jpg` from the challenge CDN link.

### Step 2: Extract Steganographic Payload
Execute `steghide extract` with the passphrase found in hints or documentation:
```bash
steghide extract -sf leaked_office.jpg -p "veyrasecure2026"
```
**Expected Output:**
```
wrote extracted data to "flag.txt".
```

### Step 3: Flag Recovery
```bash
cat flag.txt
```
**Extracted Flag:** `ROOT{st3g0_1m4g3_ph0t0_l34k_v3yr4_4f2d}`

---

## Reset Procedure
- **Mechanism:** None.
- **Explanation:** The artifact is a static image file hosted on CDN storage. No running container or mutable database state exists.
