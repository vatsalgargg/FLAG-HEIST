import { CTFProvider } from "@/context/CTFContext";
import { RequireAuth } from "@/components/RequireAuth";
import type { ReactNode } from "react";

export default function ArenaLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <CTFProvider>{children}</CTFProvider>
    </RequireAuth>
  );
}

