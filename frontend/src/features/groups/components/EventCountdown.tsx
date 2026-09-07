"use client";

import { useEffect, useMemo, useState } from "react";

interface EventCountdownProps {
  eventTime: string;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
  }
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export default function EventCountdown({ eventTime }: EventCountdownProps) {
  const target = useMemo(() => new Date(eventTime).getTime(), [eventTime]);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (Number.isNaN(target)) return null;

  const remainingMs = target - now;

  if (remainingMs <= 0) {
    return (
      <p className="group-event-countdown group-event-countdown-started">
        Event started
      </p>
    );
  }

  return (
    <p className="group-event-countdown">
      Starts in {formatRemaining(remainingMs)}
    </p>
  );
}
