"use client";

import { useEffect, useState } from "react";
import { ROOM_REVEAL_AT, TRYHACKME_ROOM_URL } from "@/data/event";

type Variant = "landing" | "arena";

function split(ms: number) {
  const total = Math.floor(ms / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

export function RoomReveal({ variant = "arena" }: { variant?: Variant }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () =>
      setRemaining(Math.max(0, new Date(ROOM_REVEAL_AT).getTime() - Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const landing = variant === "landing";
  const live = remaining !== null && remaining <= 0;
  const time = remaining === null ? null : split(remaining);

  const panelStyle = landing
    ? {
        border: "1px solid var(--rule)",
        padding: "26px 28px",
        maxWidth: "520px",
      }
    : {
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "20px 22px",
      };

  const labelStyle = {
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    opacity: 0.75,
  };

  const linkStyle = landing
    ? {
        background: "var(--paper)",
        color: "var(--ink)",
        minHeight: "48px",
        padding: "0 22px",
        display: "inline-flex",
        alignItems: "center",
        gap: "14px",
        fontSize: "14px",
        fontWeight: 600,
      }
    : {
        background: "var(--accent)",
        color: "#fff",
        padding: "12px 20px",
        borderRadius: "8px",
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        fontSize: "14px",
        fontWeight: 600,
      };

  return (
    <div style={panelStyle}>
      {live ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <span style={labelStyle}>THE ROOM IS LIVE</span>
          <a
            href={TRYHACKME_ROOM_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            Solve on TryHackMe
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 19 19 5M5 5h14v14"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <span style={labelStyle}>TRYHACKME ROOM UNLOCKS IN</span>
          <span
            aria-live="polite"
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: "clamp(26px, 6vw, 40px)",
              fontWeight: 600,
              letterSpacing: "0.02em",
              lineHeight: 1,
            }}
          >
            {time
              ? `${time.days > 0 ? `${time.days}d ` : ""}${pad(time.hours)}:${pad(time.minutes)}:${pad(time.seconds)}`
              : "--:--:--"}
          </span>
          <span style={{ fontSize: "13px", opacity: 0.75 }}>
            The link to the room appears here when the countdown ends.
          </span>
        </div>
      )}
    </div>
  );
}
