export interface InlineCategoryNameEdit {
  categoryName: string;
  draftName: string;
  wasCancelled: boolean;
}

export interface ResolvedInlineCategoryNameEdit {
  nextName: string | null;
  shouldReset: boolean;
}

export function resolveInlineCategoryNameEdit({
  categoryName,
  draftName,
  wasCancelled,
}: InlineCategoryNameEdit): ResolvedInlineCategoryNameEdit {
  if (wasCancelled) {
    return { nextName: null, shouldReset: true };
  }

  const nextName = draftName.trim();
  if (!nextName) {
    return { nextName: null, shouldReset: true };
  }

  return {
    nextName: nextName === categoryName ? null : nextName,
    shouldReset: false,
  };
}

export type CategoryUpdateTask = () => Promise<void>;

export function createCategoryUpdateQueue() {
  const updatesByCategoryId = new Map<string, Promise<void>>();

  return (categoryId: string, task: CategoryUpdateTask): Promise<void> => {
    const previousUpdate = updatesByCategoryId.get(categoryId) ?? Promise.resolve();
    const nextUpdate = previousUpdate.catch(() => undefined).then(task);

    updatesByCategoryId.set(categoryId, nextUpdate);
    void nextUpdate.then(
      () => {
        if (updatesByCategoryId.get(categoryId) === nextUpdate) {
          updatesByCategoryId.delete(categoryId);
        }
      },
      () => {
        if (updatesByCategoryId.get(categoryId) === nextUpdate) {
          updatesByCategoryId.delete(categoryId);
        }
      }
    );

    return nextUpdate;
  };
}
