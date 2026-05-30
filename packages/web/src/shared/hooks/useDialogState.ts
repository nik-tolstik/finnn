import { useState } from "react";

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

  const openDialog = (data: T) => {
    setState({ data, open: true, mounted: true });
  };

  const closeDialog = () => {
    setState((prev) => ({ ...prev, open: false }));
  };

  const unmountDialog = () => {
    setState(unmountedState);
  };

  return { ...state, openDialog, closeDialog, unmountDialog };
}
