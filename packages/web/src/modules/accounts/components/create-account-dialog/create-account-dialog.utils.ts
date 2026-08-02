const PREVIEWABLE_MONEY_PATTERN = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/;

export function getCreateAccountPreviewBalance(initialBalance: string | undefined): string {
  if (!initialBalance) {
    return "0";
  }

  return PREVIEWABLE_MONEY_PATTERN.test(initialBalance) ? initialBalance : "0";
}
