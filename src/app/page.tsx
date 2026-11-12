import Link from "next/link";
import type { Metadata } from "next";
import { EvidencePreview, HackerVisual } from "@/components/LandingExperience";
import { RoomReveal } from "@/components/RoomReveal";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "Flag Heist | 12–13 November | A Protocol CTF",
  description:
    "Plan it. Break in. Capture the flag. Flag Heist runs 12–13 November as a hybrid CTF.",
};

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={diagonal ? "M5 19 19 5M5 5h14v14" : "M4 12h15m-6-6 6 6-6 6"}
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export default function Home() {
  return (
    <div className={styles.landing}>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <div className={styles.redStage}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand} aria-label="Flag Heist home">
            <svg
              width="30"
              height="34"
              viewBox="0 0 30 34"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 31V3h21l-5 7 5 7H5"
                stroke="currentColor"
                strokeWidth="2.5"
              />
            </svg>
            FLAG HEIST
          </Link>
          <nav className={styles.nav} aria-label="Main navigation">
            <a href="#mission">The mission</a>
            <a href="#challenges">The challenges</a>
            <a href="#field-guide">Field guide</a>
          </nav>
          <Link href="/login" className={styles.headerCta}>
            Team login <Arrow diagonal />
          </Link>
        </header>
      </div>
      <main id="main">
        <div className={styles.redStage}>
          <section className={styles.hero} aria-labelledby="hero-title">
            <div className={styles.heroTopline}>
              <span>12—13 NOVEMBER</span>
              <span>A CTF BY PROTOCOL</span>
            </div>
            <div className={styles.heroCopy}>
              <h1 id="hero-title">
                PLAN IT.
                <br />
                BREAK IN.
              </h1>
              <p>
                One breach. A trail of secrets. Your next heist.
                <br />
                Think like an attacker. Capture the flag.
              </p>
              <div className={styles.heroActions}>
                <Link href="/login" className={styles.primaryButton}>
                  Enter the arena <Arrow diagonal />
                </Link>
              </div>
            </div>
            <HackerVisual />
            <div className={styles.heroBottom}>
              <span>HYBRID EVENT</span>
              <span>13 CHALLENGES. ONE STORY.</span>
              <a href="#mission">
                The briefing{" "}
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M10 3v14m-5-5 5 5 5-5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              </a>
            </div>
          </section>
        </div>
        <div className={styles.ticker} aria-hidden="true">
          <div>
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i}>
                FOLLOW THE TRAIL <i /> FIND THE FLAG <i />
              </span>
            ))}
          </div>
        </div>
        <section
          id="mission"
          className={`${styles.section} ${styles.mission}`}
          aria-labelledby="mission-title"
        >
          <h2 id="mission-title">
            EVERY BREACH
            <br />
            TELLS A STORY.
          </h2>
          <div className={styles.missionCopy}>
            <p className={styles.largeCopy}>
              Veyra Cloud Solutions was compromised.
              <br />
              You’re here to piece it back together.
            </p>
            <p>
              Trace an attacker’s path through forgotten staging sites, weak
              encryption, and the clues people leave online. Each flag uncovers
              another piece of the breach.
            </p>
            <p>
              Thirteen connected challenges. One investigation that goes all
              the way to the admin cover-up.
            </p>
            <Link className={styles.lightLink} href="/login">
              Open the first case <Arrow />
            </Link>
          </div>
        </section>
        <section
          id="challenges"
          className={`${styles.section} ${styles.challenges}`}
          aria-labelledby="challenges-title"
        >
          <div className={styles.sectionHeading}>
            <h2 id="challenges-title">PICK UP THE TRAIL.</h2>
            <p>
              A look inside the investigation.
              <br />
              The answers are yours to find.
            </p>
          </div>
          <EvidencePreview />
        </section>
        <section
          className={`${styles.section} ${styles.challenges}`}
          aria-labelledby="room-title"
        >
          <div className={styles.sectionHeading}>
            <h2 id="room-title">SOLVE IT LIVE.</h2>
            <p>
              The hands-on challenges live in the TryHackMe room.
              <br />
              The link unlocks when the countdown ends.
            </p>
          </div>
          <RoomReveal variant="landing" />
        </section>
        <section
          id="field-guide"
          className={`${styles.section} ${styles.guide}`}
          aria-labelledby="guide-title"
        >
          <div>
            <h2 id="guide-title">
              BEFORE
              <br />
              YOU BREAK IN.
            </h2>
            <p>A few things to know before the heist.</p>
          </div>
          <div className={styles.questions}>
            <details>
              <summary>
                What is Flag Heist?
                <span aria-hidden="true" />
              </summary>
              <p>
                A capture-the-flag event by Protocol. Investigate the fictional
                Veyra Cloud Solutions breach, solve security challenges, and
                submit the flags you discover to progress through the story.
              </p>
            </details>
            <details>
              <summary>
                Do I need a team?
                <span aria-hidden="true" />
              </summary>
              <p>
                Yes. The arena is for registered teams. Log in with your team
                name and the password shared by the organisers. The TryHackMe
                room itself is open to everyone.
              </p>
            </details>
            <details>
              <summary>
                When and where is it happening?
                <span aria-hidden="true" />
              </summary>
              <p>
                Flag Heist takes place on 12–13 November in hybrid mode. The
                room link appears on this page when the countdown ends.
              </p>
            </details>
            <details>
              <summary>
                What will I be solving?
                <span aria-hidden="true" />
              </summary>
              <p>
                The arena follows 13 connected challenges that tell one
                story, from the attacker&apos;s first foothold to the admin
                cover-up. Hints are available in the arena, with a score cost.
              </p>
            </details>
            <details>
              <summary>
                Who can I contact?
                <span aria-hidden="true" />
              </summary>
              <p>
                Contact Vatsal at <a href="tel:+919591305252">95913 05252</a> or
                Vismay at <a href="tel:+919031546471">90315 46471</a> for event
                questions.
              </p>
            </details>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <Link href="/login">
            Your move. Enter the arena. <Arrow diagonal />
          </Link>
          <span>A PROTOCOL EVENT</span>
        </div>
        <p className={styles.footerWordmark}>FLAG HEIST</p>
        <div className={styles.footerBottom}>
          <span>PLAN IT. BREAK IN. CAPTURE THE FLAG.</span>
          <span>12—13 NOVEMBER</span>
          <a href="#main">Back to top ↑</a>
        </div>
      </footer>
    </div>
  );
}
