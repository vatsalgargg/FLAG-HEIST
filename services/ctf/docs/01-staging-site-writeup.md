# Challenge 01 — The Forgotten Staging Site (Organiser Write-Up)

## Challenge Details
- **Challenge ID:** 1
- **Name:** The Forgotten Staging Site
- **Tier:** Intro
- **Points:** 15
- **Category:** Web / Reconnaissance
- **Flag:** `ROOT{v3yr4_st4g1ng_s1t3_l34k_7f3a2c91}`

---

## Precise Mechanism
The web server hosts static content representing the corporate landing page for Veyra Cloud Solutions. Search engine crawlers typically query `/robots.txt` upon encountering a site. The `robots.txt` file specifies a `Disallow` rule pointing directly to an unindexed, obscure path (`/not-really-hidden-7f3a2c91/`). When navigated to, this path serves an internal staging preview page displaying a developer configuration dump that contains the competition flag.

---

## Exact Triggering Input & Expected Output

### Step 1: Inspect robots.txt
- **Input:**
  ```http
  GET /robots.txt HTTP/1.1
  Host: staging.rootctf.example.com
  ```
- **Expected Output (HTTP 200 OK):**
  ```txt
  User-agent: *
  Disallow: /not-really-hidden-7f3a2c91/
  ```

### Step 2: Fetch Hidden Staging Directory
- **Input:**
  ```http
  GET /not-really-hidden-7f3a2c91/ HTTP/1.1
  Host: staging.rootctf.example.com
  ```
- **Expected Output (HTTP 200 OK):**
  HTML document containing:
  ```html
  <div class="secret">ROOT{v3yr4_st4g1ng_s1t3_l34k_7f3a2c91}</div>
  ```

### Step 3: Flag Recovery
- **Flag Extracted:** `ROOT{v3yr4_st4g1ng_s1t3_l34k_7f3a2c91}`

---

## Reset Procedure
- **Mechanism:** None.
- **Explanation:** This challenge consists purely of static HTML and text files served via CDN or object storage (Cloudflare Pages / Cloudflare R2 / S3). It has zero server-side state, zero database dependencies, and cannot be mutated or corrupted by participant actions.
