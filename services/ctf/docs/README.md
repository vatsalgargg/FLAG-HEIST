# ROOT CTF — Organiser Documentation Master Index (/docs)

**Purpose & Scope:**
This directory serves as the confidential master repository for CTF organiser materials, instructor solution write-ups, operational playbooks, and verification procedures for the **ROOT CTF: The Veyra Cloud Solutions Incident** competition.

> [!WARNING]
> **Confidential Organiser Materials:** Content in this folder must NEVER be exposed publicly or bundled into participant-facing client builds or public repositories.

---

## 1. Challenge Master Solutions (All 13 Modules)

Each instructor write-up documents the exact trigger input, expected output, underlying concept, intentional teaching gap, and emergency reset procedure.

| # | Challenge Name | Target System | Category / Teaching Gap | Write-Up Link |
| :-: | :--- | :--- | :--- | :--- |
| **01** | The Forgotten Staging Site | Veyra Staging Site | Information Disclosure (`robots.txt`) | [01-staging-site-writeup.md](file:///Users/avishjain/avishjain9-repos/ctf/docs/01-staging-site-writeup.md) |
| **02** | The Broken Lock | RSA Cryptography | Factoring Small Primes ($e=65537$) | [02-broken-lock-writeup.md](file:///Users/avishjain/avishjain9-repos/ctf/docs/02-broken-lock-writeup.md) <br> *Solver:* [solve_challenge_02.py](file:///Users/avishjain/avishjain9-repos/ctf/docs/solve_challenge_02.py) |
| **03** | The Twitter Trail | Social Media OSINT | Visible Profile Detail Investigation | [03-twitter-trail-writeup.md](file:///Users/avishjain/avishjain9-repos/ctf/docs/03-twitter-trail-writeup.md) |
| **04** | The Employee Portal | Internal Staff Login | Unlisted Portal & Factory Default Creds | [04-employee-portal-writeup.md](file:///Users/avishjain/avishjain9-repos/ctf/docs/04-employee-portal-writeup.md) |
| **05** | Who Is Ethan Cole? | Personnel Search | Unescaped Quote / Hash Cracking | [05-who-is-ethan-cole-writeup.md](file:///Users/avishjain/avishjain9-repos/ctf/docs/05-who-is-ethan-cole-writeup.md) |
| **06** | The Leaked Photo | Image Forensics | Steganographic Data Hiding | [06-leaked-photo-writeup.md](file:///Users/avishjain/avishjain9-repos/ctf/docs/06-leaked-photo-writeup.md) |
| **07** | The Invoice Trail | Billing Application | Deterministic Keyed Transform & IDOR | [07-invoice-trail-writeup.md](file:///Users/avishjain/avishjain9-repos/ctf/docs/07-invoice-trail-writeup.md) |
| **08** | The Internal Dashboard | Operations Dashboard | Unlinked Route in Production Bundle | [08-internal-dashboard-writeup.md](file:///Users/avishjain/avishjain9-repos/ctf/docs/08-internal-dashboard-writeup.md) |
| **09** | The Session Bug | Session Engine | Custom Keyed Checksum Forgery | [09-session-bug-writeup.md](file:///Users/avishjain/avishjain9-repos/ctf/docs/09-session-bug-writeup.md) |
| **10** | The Config Backup | Config Exporter | Pre-Decode Path Traversal Filter Bypass | [10-config-backup-writeup.md](file:///Users/avishjain/avishjain9-repos/ctf/docs/10-config-backup-writeup.md) |
| **11** | The Debug Trace | Distributed Logs | Multi-Service Clock Offset Correlation | [11-debug-trace-writeup.md](file:///Users/avishjain/avishjain9-repos/ctf/docs/11-debug-trace-writeup.md) |
| **12** | The Diagnostics Backdoor | Network Diagnostics | Blind Command Injection & Collab Callback | [12-diagnostics-backdoor-writeup.md](file:///Users/avishjain/avishjain9-repos/ctf/docs/12-diagnostics-backdoor-writeup.md) |
| **13** | The Admin Cover-Up (Final) | Core Administration | 5-Stage Access Control / SSRF Chain | [13-admin-coverup-writeup.md](file:///Users/avishjain/avishjain9-repos/ctf/docs/13-admin-coverup-writeup.md) |

---

## 2. Operational Playbooks & Runbooks

- **[Live-Ops Runbook & Shift-Handoff Guide](file:///Users/avishjain/avishjain9-repos/ctf/docs/live-ops-runbook.md):**
  Plain-language guide for desk organisers and shift leads: what healthy looks like, handling broken module reports, score dispute investigations, alert response, and shift-handoff template.
- **[Emergency Break-Glass Admin Recovery Runbook](file:///Users/avishjain/avishjain9-repos/ctf/docs/break-glass-admin-recovery.md):**
  Out-of-band CLI tool and direct database procedure for regaining administrative access if ever locked out of the Admin Console.
- **[Launch Readiness & Go/No-Go Checklist](file:///Users/avishjain/avishjain9-repos/ctf/docs/LAUNCH_CHECKLIST.md):**
  Pre-flight verification criteria and evidence required before competition kickoff.
- **[Go-Live Operations & Deployment Manual](file:///Users/avishjain/avishjain9-repos/ctf/docs/GO_LIVE.md):**
  Detailed cloud provisioning, secret configuration, and deployment runbook.
- **[Post-Event Teardown & Security Decommission Checklist](file:///Users/avishjain/avishjain9-repos/ctf/docs/teardown-checklist.md):**
  Decommissioning order, data retention schedule, credential rotation matrix, and active unreachability verification.
