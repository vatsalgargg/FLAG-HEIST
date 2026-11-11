import Link from "next/link";
import type { ReactNode } from "react";
export function PlatformShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="arena-page">
      <header className="arena-header">
        <Link href="/">Flag Heist</Link>
        <nav aria-label="Competition">
          <Link href="/arena">Arena</Link>
          <Link href="/leaderboard">Leaderboard</Link>
        </nav>
      </header>
      <main className="arena-content">
        <h1>{title}</h1>
        {children}
      </main>
    </div>
  );
}
