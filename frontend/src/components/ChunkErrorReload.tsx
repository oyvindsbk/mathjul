"use client";

import { useEffect } from "react";

const RELOAD_FLAG = "chunk-reload-attempted";
const CHUNK_ERROR_PATTERN = /ChunkLoadError|Loading chunk [\d]+ failed/i;

function reloadOnce() {
  if (sessionStorage.getItem(RELOAD_FLAG)) return;
  sessionStorage.setItem(RELOAD_FLAG, "1");
  window.location.reload();
}

export default function ChunkErrorReload() {
  useEffect(() => {
    sessionStorage.removeItem(RELOAD_FLAG);

    const handleError = (event: ErrorEvent) => {
      if (CHUNK_ERROR_PATTERN.test(event.message)) {
        reloadOnce();
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        typeof reason === "string" ? reason : reason?.message ?? "";
      if (CHUNK_ERROR_PATTERN.test(message)) {
        reloadOnce();
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
