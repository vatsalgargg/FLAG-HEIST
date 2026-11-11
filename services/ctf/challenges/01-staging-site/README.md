# Challenge 01 — Staging Site

## Overview
- **Category:** Web / Reconnaissance
- **Target:** Veyra Staging Web Portal
- **Phase:** Phase C (Static / low-complexity challenges — Prompt 9)
- **Vulnerability Concept:** `robots.txt` information disclosure with an unguessable Disallow slug leading to a hidden developer flag page.

## ARCHITECTURAL NOTE: NO BACKEND REQUIRED
> [!IMPORTANT]
> **This challenge does NOT need a backend service.**
> Do not scaffold or deploy a container or server for this challenge.
> It is served strictly as static HTML/text files via CDN (Cloudflare Pages / AWS S3 / Cloudflare R2).
> Serving this as static files ensures zero origin compute load regardless of how many concurrent participants view it.

## Assets Directory
- `/public/`: Will contain `index.html`, `robots.txt`, and the hidden staging flag page.
