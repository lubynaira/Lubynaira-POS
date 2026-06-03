"use client";

import { useEffect } from "react";

export function usePwa() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // PWA still works as a regular web app when registration is unavailable.
    });
  }, []);
}
