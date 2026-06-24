import { useCallback, useEffect, useRef, useState } from "react";

type MountedState<T> = {
  mounted: true;
  data: T;
  open: boolean;
};

type UnmountedState = {
  mounted: false;
  open: false;
  data: null;
};

type DialogState<T> = MountedState<T> | UnmountedState;

const unmountedState: UnmountedState = {
  mounted: false,
  open: false,
  data: null,
};

export function useDialogState<T>() {
  const [state, setState] = useState<DialogState<T>>(unmountedState);
  const openFrameRef = useRef<number | null>(null);

  const cancelScheduledOpen = useCallback(() => {
    if (openFrameRef.current === null) return;
    window.cancelAnimationFrame(openFrameRef.current);
    openFrameRef.current = null;
  }, []);

  const openDialog = useCallback(
    (data: T) => {
      cancelScheduledOpen();
      setState({ data, open: false, mounted: true });

      openFrameRef.current = window.requestAnimationFrame(() => {
        openFrameRef.current = null;
        setState((prev) => (prev.mounted ? { ...prev, open: true } : prev));
      });
    },
    [cancelScheduledOpen]
  );

  const closeDialog = useCallback(() => {
    cancelScheduledOpen();
    setState((prev) => ({ ...prev, open: false }));
  }, [cancelScheduledOpen]);

  const unmountDialog = useCallback(() => {
    cancelScheduledOpen();
    setState(unmountedState);
  }, [cancelScheduledOpen]);

  useEffect(() => cancelScheduledOpen, [cancelScheduledOpen]);

  return { ...state, openDialog, closeDialog, unmountDialog };
}
