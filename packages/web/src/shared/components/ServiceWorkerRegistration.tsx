import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const hadController = Boolean(navigator.serviceWorker.controller);
    let disposed = false;
    let refreshing = false;
    let registration: ServiceWorkerRegistration | undefined;
    let updateIntervalId: number | undefined;
    const stateChangeHandlers = new Map<ServiceWorker, () => void>();

    const handleControllerChange = () => {
      if (hadController && !refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };

    const handleUpdateFound = () => {
      const newWorker = registration?.installing;
      if (!newWorker) {
        return;
      }

      if (stateChangeHandlers.has(newWorker)) {
        return;
      }

      const handleStateChange = () => {
        if (newWorker.state === "installed") {
          newWorker.removeEventListener("statechange", handleStateChange);
          stateChangeHandlers.delete(newWorker);
          if (navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: "SKIP_WAITING" });
          }
        }
      };

      stateChangeHandlers.set(newWorker, handleStateChange);
      newWorker.addEventListener("statechange", handleStateChange);
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    void navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registeredWorker) => {
        if (disposed) {
          return;
        }

        registration = registeredWorker;
        registration.addEventListener("updatefound", handleUpdateFound);
        handleUpdateFound();

        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        updateIntervalId = window.setInterval(() => {
          void registration?.update().catch(() => undefined);
        }, 60000);
      })
      .catch((error) => {
        if (!disposed) {
          console.error("Service Worker registration failed:", error);
        }
      });

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      registration?.removeEventListener("updatefound", handleUpdateFound);
      for (const [worker, handler] of stateChangeHandlers) {
        worker.removeEventListener("statechange", handler);
      }
      stateChangeHandlers.clear();
      if (updateIntervalId !== undefined) {
        window.clearInterval(updateIntervalId);
      }
    };
  }, []);

  return null;
}
