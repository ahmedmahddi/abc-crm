"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function SyncStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const updateConnectionState = () => setIsOnline(navigator.onLine);
    updateConnectionState();
    window.addEventListener("online", updateConnectionState);
    window.addEventListener("offline", updateConnectionState);
    return () => {
      window.removeEventListener("online", updateConnectionState);
      window.removeEventListener("offline", updateConnectionState);
    };
  }, []);

  return (
    <Badge className="gap-1.5" aria-live="polite">
      {isOnline ? <Cloud aria-hidden="true" className="size-3.5" /> : <CloudOff aria-hidden="true" className="size-3.5" />}
      {isOnline ? "Synchronisé" : "Mode hors ligne"}
    </Badge>
  );
}
