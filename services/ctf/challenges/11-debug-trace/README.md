# Challenge 11 — Debug Trace

## Overview
- **Category:** Forensics / Log Correlation
- **Target:** Multi-service application debug and transaction trace logs
- **Phase:** Phase C (Prompt 9 — Synthetic log generator)
- **Vulnerability Concept:** Correlation analysis over simulated distributed server logs across 3+ services with varying timestamp formats, fixed clock drift, and matching request correlation IDs revealing attacker activity.

## ARCHITECTURAL NOTE: NO BACKEND REQUIRED
> [!IMPORTANT]
> **This challenge does NOT need a backend service.**
> Do not scaffold or deploy a container or server for this challenge.
> A generator script runs once at build time to produce synthetic log archives. These static log files are uploaded to the CDN for participants to download and analyze offline.
> Never run this as a live logging server for 3 days.

## Assets Directory
- `/logs/`: Directory where build-time synthetic logs and the generation script will reside.
