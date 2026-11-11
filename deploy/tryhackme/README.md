# Flag Heist as a TryHackMe room

Each TryHackMe player gets their own copy of this machine. The machine runs every
challenge plus the **mission console** (the Flag Heist web app) on port 80, where the
player logs in with a built-in operator account to see targets, download evidence and
get their callback URL for Tasks 12–13. Answers are submitted on TryHackMe.

## Files

| File | Purpose |
|---|---|
| `build-vm.sh` | Run once inside a fresh Ubuntu VM: installs, builds, strips source, hardens |
| `flagheist-boot.sh` + `.service` | Every boot: detect machine IP, set links, start services, ensure operator account |
| `flagheist-console.service` | Mission console on port 80 |
| `provision-operator.js` | Creates the `operator@veyra.thm` account (idempotent) |
| `generate-room.mjs` | Writes `room/ROOM.md` (public room text) and `room/ANSWERS.private.md` |
| `room/ROOM.md` | Copy into the TryHackMe room editor |
| `room/ANSWERS.private.md` | **Private.** Answers for the room editor. Git-ignored, never copied to the VM |

Regenerate the room text after changing challenges:
`node --experimental-strip-types deploy/tryhackme/generate-room.mjs`

## 1. Build the machine

1. Create a VM in VirtualBox or VMware: **Ubuntu Server 22.04 or 24.04, x86_64**,
   2 vCPU, **4 GB RAM**, 25 GB disk, NAT network (internet needed only while building).
2. Copy the project into it (shared folder, `scp`, or a USB/ISO). Do **not** copy
   `deploy/tryhackme/room/` — the build script excludes it anyway.
3. Inside the VM:
   ```bash
   cd flag-heist-ctf-main
   sudo bash deploy/tryhackme/build-vm.sh
   ```
4. Test from your host: open `http://<vm-ip>/`, log in as `operator@veyra.thm` /
   `HeistOperator2026`, open a few targets, and solve one task.
5. Reboot the VM once and check everything comes back by itself (about 2–3 min).
6. Delete the original project copy you used for building (e.g. `rm -rf ~/flag-heist-ctf-main`)
   — it still contains source code and flags. Remove any SSH key you added.
7. `sudo shutdown now`, then export as **.ova** (VirtualBox: File → Export Appliance).

## 2. Create the room on TryHackMe

1. Go to TryHackMe → **Create Room** and upload the `.ova` as the room's machine
   (check TryHackMe's current upload requirements and limits).
2. Fill in the room using `room/ROOM.md`:
   - Title, short description, difficulty, tags.
   - **Task 0** (introduction) with the console URL and operator login.
   - **Tasks 1–13**: paste the text, add one question each, set the hint.
3. Copy each answer from `room/ANSWERS.private.md` into the matching question's answer field.
4. Use `MACHINE_IP` in task text — TryHackMe replaces it with each player's machine IP.
5. Publish privately first and play the full room once from a fresh machine.

## What players can and cannot reach

- **Open ports:** 80 (console), 3101–3113 (challenge targets), 8182 (callback log).
- **Not exposed:** the scoring API (bound to 127.0.0.1), Redis, the sandbox networks.
- **Not on disk:** challenge source, solution READMEs, generators, the room answers.
  Flags exist only inside the built Docker images and as salted hashes in the database.
- **SSH:** password login disabled by the build script.
- **Admin panel:** random admin password generated at build time and never shown.

## Known limits

- A player who fully escapes a challenge container to the host could read the images.
  The sandboxed tasks (10, 12, 13) run in throwaway containers with no Docker socket,
  no capabilities and an internal-only network, so this needs a real container escape.
- Task 7/8's shared login is intended; on TryHackMe each player has their own machine,
  so players do not see each other.
