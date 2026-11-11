"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import styles from "./TeamAuth.module.css";

export function TeamAuth() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/auth/login", {
        leader_email: String(form.get("leader_email")).trim(),
        password: form.get("password"),
      });
      router.replace("/arena");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Flag Heist home">
          <svg width="30" height="34" viewBox="0 0 30 34" fill="none" aria-hidden="true">
            <path d="M5 31V3h21l-5 7 5 7H5" stroke="currentColor" strokeWidth="2.5" />
          </svg>
          FLAG HEIST
        </Link>
        <Link href="/" className={styles.back}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M20 12H4m6-6-6 6 6 6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          Back to the briefing
        </Link>
      </header>
      <main className={styles.main}>
        <div className={styles.intro}>
          <p className={styles.statement}>BACK TO<br />THE HEIST.</p>
          <p className={styles.description}>
            One breach. A trail of secrets.<br />Your crew has a case to crack.
          </p>
          <p className={styles.event}>12–13 November · A Protocol CTF</p>
        </div>
        <section className={styles.panel} aria-labelledby="login-title">
          <h1 id="login-title">Team login</h1>
          <p className={styles.subtitle}>Use your team leader’s credentials to enter the arena.</p>
          <form className={styles.form} onSubmit={submit} aria-busy={busy}>
            <label htmlFor="leader-email">Team leader email</label>
            <input id="leader-email" name="leader_email" type="email" required maxLength={254}
              autoComplete="username" autoCapitalize="none" spellCheck={false}
              aria-describedby="account-note" />
            <label htmlFor="password">Password</label>
            <div className={styles.passwordField}>
              <input id="password" name="password" type={showPassword ? "text" : "password"}
                required maxLength={72} autoComplete="current-password" />
              <button type="button" className={styles.reveal} aria-controls="password"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button className={styles.submit} type="submit" disabled={busy}>
              <span>{busy ? "Signing in…" : "Enter the arena"}</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 12h16m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" />
              </svg>
            </button>
          </form>
          <p id="account-note" className={styles.note}>
            Access is for approved teams. Need credentials or a password reset? Contact an event organiser.
          </p>
        </section>
      </main>
      <footer className={styles.footer}>
        <span>Plan it. Break in. Capture the flag.</span>
        <Link href="/leaderboard">Leaderboard</Link>
      </footer>
    </div>
  );
}
