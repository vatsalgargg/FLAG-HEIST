import { CTFProvider } from "@/context/CTFContext";
import type { ReactNode } from "react";

export default function ArenaLayout({ children }: { children: ReactNode }) {
  return <CTFProvider>{children}</CTFProvider>;
}

