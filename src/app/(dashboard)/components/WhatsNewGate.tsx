"use client";

import { useEffect } from "react";

import { WhatsNewModal } from "@/app/(dashboard)/components/WhatsNewModal";
import { useUIStore } from "@/stores/ui-store";

const WHATS_NEW_MODAL_ID = "whats-new";
const SESSION_STORAGE_KEY = "finhub-whats-new-shown";

export function WhatsNewGate() {
  const isOpen = useUIStore((s) => s.modals[WHATS_NEW_MODAL_ID] === true);
  const openModal = useUIStore((s) => s.openModal);
  const closeModal = useUIStore((s) => s.closeModal);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_STORAGE_KEY) !== "true") {
      sessionStorage.setItem(SESSION_STORAGE_KEY, "true");
      openModal(WHATS_NEW_MODAL_ID);
    }
  }, [openModal]);

  return (
    <WhatsNewModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closeModal(WHATS_NEW_MODAL_ID);
      }}
    />
  );
}
