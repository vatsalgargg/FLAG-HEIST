import Link from "next/link";
import type { Metadata } from "next";
import {
  EvidencePreview,
  HackerVisual,
  TeamRegistration,
} from "@/components/LandingExperience";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "Flag Heist | 12–13 November | A Protocol CTF",
  description:
    "Plan it. Break in. Capture the flag. Join Flag Heist on 12–13 November: a hybrid CTF for teams of one to three.",
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
          <a href="#register" className={styles.headerCta}>
            Join the heist <Arrow diagonal />
          </a>
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
                <a href="#register" className={styles.primaryButton}>
                  Join the heist <Arrow diagonal />
                </a>
                <Link href="/login" className={styles.textLink}>
                  Enter the arena <Arrow diagonal />
                </Link>
              </div>
            </div>
            <HackerVisual />
            <div className={styles.heroBottom}>
              <span>HYBRID EVENT</span>
              <span>GO SOLO. OR BRING YOUR CREW.</span>
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
              Thirteen connected challenges. Three difficulty tiers. One
              investigation that goes all the way to the admin cover-up.
            </p>
            <Link className={styles.lightLink} href="/arena">
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
          id="register"
          className={styles.registration}
          aria-labelledby="register-title"
        >
          <div className={styles.registrationIntro}>
            <h2 id="register-title">
              ASSEMBLE
              <br />
              YOUR CREW.
            </h2>
            <p>
              12–13 November. Online and on the ground.
              <br />
              One to three people. One shared mission.
            </p>
            <div className={styles.loot}>
              <svg
                width="27"
                height="27"
                viewBox="0 0 28 28"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="m14 2 11 6v12l-11 6L3 20V8l11-6Zm0 0v24M3 8l11 6 11-6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
              <span>THE LOOT</span>
              <strong>CLASSIFIED</strong>
            </div>
          </div>
          <TeamRegistration />
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
                Can I participate on my own?
                <span aria-hidden="true" />
              </summary>
              <p>
                Yes. Enter solo for ₹75, as a duo for ₹100, or as a team of
                three for ₹150. You can register through the event registration
                form.
              </p>
            </details>
            <details>
              <summary>
                When and where is it happening?
                <span aria-hidden="true" />
              </summary>
              <p>
                Flag Heist takes place on 12–13 November in hybrid mode. Check
                the registration form or contact the organizers for the schedule
                and joining instructions.
              </p>
            </details>
            <details>
              <summary>
                What will I be solving?
                <span aria-hidden="true" />
              </summary>
              <p>
                The arena follows 13 connected challenges across introductory,
                progressive, and final tiers. Expect web exploitation,
                cryptography, and open-source investigation. Hints are available
                in the arena, with a score cost.
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
                and registration questions.{" "}
                <a
                  href="/media/event-banner.png"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View the event banner.
                </a>
              </p>
            </details>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <a href="#register">
            Your move. Join the heist. <Arrow diagonal />
          </a>
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
