"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
type Announcement = { id: string; message: string; severity: string };
export function Announcements() {
  const [items, setItems] = useState<Announcement[]>([]);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      api<Announcement[]>("/announcements")
        .then((data) => {
          if (active) setItems(data);
        })
        .catch(() => {});
    void refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <div aria-live="polite">
      {items.map((item) => (
        <div
          className={`arena-announcement severity-${item.severity}`}
          key={item.id}
        >
          <strong>{item.severity}: </strong>
          {item.message}
        </div>
      ))}
    </div>
  );
}
