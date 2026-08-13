"use client";

import { useEffect, useState } from "react";

export interface UseWakeLock {
  /** Whether the browser exposes the Screen Wake Lock API at all. */
  supported: boolean;
  /** Whether a lock is currently held. */
  active: boolean;
}

/**
 * Hold a screen wake lock while `enabled` is true, so the phone does not sleep
 * mid-cook.
 *
 * Two things make this less trivial than it looks:
 *
 * 1. The browser releases the lock on its own whenever the page stops being
 *    visible — switching apps, locking the phone, changing tabs. It is not
 *    restored on return, so without re-acquiring on `visibilitychange` the
 *    feature works exactly once and then silently stops. That failure is
 *    invisible in tests and only shows up on a real device.
 * 2. Support is uneven (absent on Firefox and iOS Safari before 16.4). Absence
 *    is a silent no-op, never an error — the overlay must still work.
 */
export function useWakeLock(enabled: boolean): UseWakeLock {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && "wakeLock" in navigator);
  }, []);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return;
    }

    // Tracks the latest lock so the cleanup below releases the right one, and
    // so a release that lands after unmount cannot flip state on a dead component.
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void sentinel.release();
          sentinel = null;
          return;
        }
        setActive(true);
        sentinel.addEventListener("release", () => {
          if (!cancelled) setActive(false);
        });
      } catch {
        // Denied (often a low-battery policy) or unsupported in this context.
        // Cooking continues without it.
        if (!cancelled) setActive(false);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && !sentinel) {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void sentinel?.release().catch(() => {
        // Already released by the browser — nothing to do.
      });
      sentinel = null;
      setActive(false);
    };
  }, [enabled]);

  return { supported, active };
}
