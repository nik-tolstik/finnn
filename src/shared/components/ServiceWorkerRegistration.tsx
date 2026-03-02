"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => {
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  sessionStorage.setItem("finnn-whats-new-shown", "false");
                  newWorker.postMessage({ type: "SKIP_WAITING" });
                }
              });
            }
          });

          if (registration.waiting) {
            sessionStorage.setItem("finnn-whats-new-shown", "false");
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }

          setInterval(() => {
            registration.update();
          }, 60000);
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  return null;
}
