"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { WhatsNewModal } from "@/app/(dashboard)/components/WhatsNewModal";
import { APP_VERSION } from "@/shared/constants/changelog";
import { useUIStore } from "@/stores/ui-store";

const WHATS_NEW_MODAL_ID = "whats-new";

async function getWhatsNewStatus() {
  const response = await fetch("/api/whats-new/status");
  if (!response.ok) {
    throw new Error("Не удалось получить статус");
  }
  const result = await response.json();
  if (result.error) {
    throw new Error(result.error);
  }
  return result.data;
}

async function updateWhatsNewStatus() {
  const response = await fetch("/api/whats-new/status", {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Не удалось обновить статус");
  }
  const result = await response.json();
  if (result.error) {
    throw new Error(result.error);
  }
  return result.data;
}

export function WhatsNewGate() {
  const { data: session } = useSession();
  const [isMounted, setIsMounted] = useState(false);
  const isOpen = useUIStore((s) => s.modals[WHATS_NEW_MODAL_ID] === true);
  const openModal = useUIStore((s) => s.openModal);
  const closeModal = useUIStore((s) => s.closeModal);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { data: statusData } = useQuery({
    queryKey: ["whats-new-status"],
    queryFn: getWhatsNewStatus,
    enabled: !!session?.user?.id && isMounted,
    staleTime: Infinity,
  });

  const updateStatusMutation = useMutation({
    mutationFn: updateWhatsNewStatus,
  });

  useEffect(() => {
    if (!isMounted) return;
    if (!session?.user?.id) return;
    if (statusData === undefined) return;

    const shouldShowModal =
      !statusData || statusData.version !== APP_VERSION || !statusData.shown;

    if (shouldShowModal) {
      openModal(WHATS_NEW_MODAL_ID);
    }
  }, [isMounted, session?.user?.id, statusData, openModal]);

  const handleClose = (open: boolean) => {
    if (!open) {
      closeModal(WHATS_NEW_MODAL_ID);
      if (session?.user?.id) {
        updateStatusMutation.mutate();
      }
    }
  };

  if (!isMounted) {
    return null;
  }

  return (
    <WhatsNewModal
      open={isOpen}
      onOpenChange={handleClose}
    />
  );
}
