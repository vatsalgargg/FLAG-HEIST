"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useIsClient } from "@/context/AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isClient = useIsClient();
  const router = useRouter();

  useEffect(() => {
    if (isClient && !user) router.replace("/login");
  }, [isClient, user, router]);

  if (!isClient || !user) return null;

  return <>{children}</>;
}
