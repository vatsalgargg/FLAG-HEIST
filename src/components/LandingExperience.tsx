"use client";

import { useId, useState } from "react";
import Image from "next/image";
import styles from "@/app/landing.module.css";

const tracks = [
  {
    name: "Web exploitation",
    title: "The Forgotten Staging Site",
    file: "staging_environment",
    category: "WEB / INTRO",
    body: "An old staging environment is still live. No visible links. No obvious clues. Find what the server was never meant to leave behind.",
    clue: "The attacker’s entry point was hiding in plain sight.",
  },
  {
    name: "Cryptography",
    title: "The Broken Lock",
    file: "encrypted_message",
    category: "CRYPTO / INTRO",
    body: "A recovered internal message is locked with RSA. Veyra believed its public key was harmless. Investigate the lock and recover the message.",
    clue: "A public key is only as strong as the numbers behind it.",
  },
  {
    name: "Open-source intelligence",
    title: "The Twitter Trail",
    file: "public_profile",
    category: "OSINT / INTRO",
    body: "Before targeting the system, the attacker studied its people. Follow an employee’s public profile and look for the detail everyone else scrolled past.",
    clue: "The investigation starts with what’s already public.",
  },
];

export function HackerVisual() {
  const [paused, setPaused] = useState(false);
  return (
    <div className={`${styles.hackerStage} ${paused ? styles.paused : ""}`}>
      <div className={styles.artFrame} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className={styles.orbitBack} aria-hidden="true" />
      <div className={styles.hackerFigure}>
        <Image
          src="/media/heist-hacker.png"
          alt="A red-hooded hacker wearing an ivory mask and carrying a white flag"
          width={1024}
          height={1536}
          priority
          sizes="(max-width: 600px) 95vw, (max-width: 1000px) 58vw, 660px"
        />
      </div>
      <div className={styles.orbitFront} aria-hidden="true" />
      <div className={styles.crosshair} aria-hidden="true">
        <span />
        <span />
      </div>
      <button
        className={styles.motionToggle}
        onClick={() => setPaused(!paused)}
        aria-label={paused ? "Play hero animation" : "Pause hero animation"}
        aria-pressed={paused}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="currentColor"
          aria-hidden="true"
        >
          {paused ? (
            <path d="m3 1 8 5-8 5V1Z" />
          ) : (
            <>
              <path d="M2 1h3v10H2zM7 1h3v10H7z" />
            </>
          )}
        </svg>
        <span>{paused ? "PLAY MOTION" : "PAUSE MOTION"}</span>
      </button>
    </div>
  );
}

export function EvidencePreview() {
  const [selected, setSelected] = useState(0);
  const id = useId();
  const track = tracks[selected];
  return (
    <div className={styles.evidenceLayout}>
      <div
        className={styles.trackList}
        role="tablist"
        aria-label="Challenge tracks"
        aria-orientation="vertical"
      >
        {tracks.map((item, i) => (
          <button
            key={item.name}
            id={`${id}-tab-${i}`}
            type="button"
            role="tab"
            aria-selected={selected === i}
            aria-controls={`${id}-panel`}
            tabIndex={selected === i ? 0 : -1}
            onClick={() => setSelected(i)}
            onKeyDown={(event) => {
              let next = i;
              if (event.key === "ArrowDown") next = (i + 1) % tracks.length;
              else if (event.key === "ArrowUp")
                next = (i + tracks.length - 1) % tracks.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = tracks.length - 1;
              else return;
              event.preventDefault();
              setSelected(next);
              document.getElementById(`${id}-tab-${next}`)?.focus();
            }}
          >
            <span>{item.name}</span>
            <svg
              width="23"
              height="23"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 12h15m-6-6 6 6-6 6"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        ))}
        <p>
          Start with the clues. Follow the connections.
          <br />
          Every captured flag takes you deeper.
        </p>
      </div>
      <div
        className={styles.caseFile}
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${selected}`}
        tabIndex={0}
      >
        <div className={styles.fileHeader}>
          <span>{track.file}.txt</span>
          <span>{track.category}</span>
        </div>
        <div key={selected} className={styles.fileBody}>
          <div className={styles.fileIcon} aria-hidden="true">
            <svg width="40" height="46" viewBox="0 0 40 46" fill="none">
              <path
                d="M6 2h19l10 10v32H6V2Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M25 2v11h10M13 23h15M13 29h15M13 35h9"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </div>
          <h3>{track.title}</h3>
          <p>{track.body}</p>
          <blockquote>{track.clue}</blockquote>
        </div>
        <div className={styles.fileFooter}>
          <span>BRIEFING PREVIEW</span>
          <span>15 PTS</span>
        </div>
      </div>
    </div>
  );
}

const registrationUrl =
  "https://docs.google.com/forms/d/e/1FAIpQLScvdT0v5UVwB03UDiszKSakOfONLL02DawCJdXlk43DW-tECQ/viewform";

export function TeamRegistration() {
  const [size, setSize] = useState(1);
  const fees = [75, 100, 150];
  return (
    <div className={styles.teamRegistration}>
      <fieldset>
        <legend>HOW MANY IN YOUR CREW?</legend>
        <div className={styles.teamOptions}>
          {["Lone wolf", "Duo", "Trio"].map((name, i) => (
            <label
              key={name}
              className={size === i + 1 ? styles.selectedTeam : ""}
            >
              <input
                type="radio"
                name="team-size"
                value={i + 1}
                checked={size === i + 1}
                onChange={() => setSize(i + 1)}
              />
              <span className={styles.teamNumber}>
                {i + 1}
              </span>
              <span>{name}</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="m3 8 3 3 7-7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </label>
          ))}
        </div>
      </fieldset>
      <div className={styles.feeLine}>
        <div>
          <span>ENTRY FEE</span>
          <p>{size === 1 ? "For one operative" : `For your team of ${size}`}</p>
        </div>
        <strong aria-live="polite">
          ₹{fees[size - 1]}
          <small> / team</small>
        </strong>
      </div>
      <a
        className={styles.registerButton}
        href={registrationUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Register your {size === 1 ? "entry" : "crew"}
        <svg
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 19 19 5M5 5h14v14"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </a>
      <p className={styles.formNote}>
        Opens the official registration form in a new tab.
        <br />
        Select your team size again in the form.
      </p>
    </div>
  );
}
