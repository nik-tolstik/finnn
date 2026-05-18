export type ActionError = {
  error: string;
  data?: never;
  success?: never;
};

export type ActionData<T> = {
  data: T;
  error?: never;
  success?: never;
};

export type ActionSuccess<TExtra extends object = object> = {
  success: true;
  error?: never;
  data?: never;
} & TExtra;

export type ActionResult<T> = ActionData<T> | ActionSuccess | ActionError;

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function ok<T>(data: T): ActionData<T> {
  return { data };
}

export function success<TExtra extends object = object>(extra?: TExtra): ActionSuccess<TExtra> {
  return { success: true, ...(extra ?? ({} as TExtra)) };
}

export function fail(error: unknown, fallback: string): ActionError {
  return { error: getErrorMessage(error, fallback) };
}
