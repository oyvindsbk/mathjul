"use client";

import { useEffect, useState } from "react";

export function UpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const checkForWaiting = (registration: ServiceWorkerRegistration) => {
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        return;
      }
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
          }
        });
      });
    };

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) checkForWaiting(reg);
    });
  }, []);

  const handleUpdate = () => {
    if (!waitingWorker) return;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    window.location.reload();
  };

  if (!waitingWorker) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 md:bottom-6">
      <div className="flex items-center gap-3 bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg border border-slate-700">
        <span className="text-sm">Ny versjon tilgjengelig</span>
        <button
          onClick={handleUpdate}
          className="text-sm font-medium bg-white text-slate-900 px-3 py-1 rounded hover:bg-slate-100 transition-colors"
        >
          Last inn på nytt
        </button>
        <button
          onClick={() => setWaitingWorker(null)}
          className="text-slate-400 hover:text-white transition-colors text-lg leading-none"
          aria-label="Lukk"
        >
          ×
        </button>
      </div>
    </div>
  );
}
