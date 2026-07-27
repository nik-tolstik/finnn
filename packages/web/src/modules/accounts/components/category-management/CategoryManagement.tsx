"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  deleteCategory,
  getCategories,
  getCategoryTransactionCount,
  updateCategoriesOrder,
  updateCategory,
} from "@/modules/categories/category.api";
import { CategoryType } from "@/modules/categories/category.constants";
import type { Category } from "@/modules/categories/category.types";
import { CategoryIconPicker } from "@/shared/components/category-icon-picker";
import { useDialogState } from "@/shared/hooks/useDialogState";
import {
  removeCategoriesFromCache,
  runOptimisticWorkspaceMutation,
  updateCategoriesInCache,
} from "@/shared/lib/optimistic-workspace-updates";
import { categoryKeys } from "@/shared/lib/query-keys";
import type { UpdateCategoryInput } from "@/shared/lib/validations/category";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Segmented } from "@/shared/ui/segmented";

import { CreateCategoryDialog } from "../create-category-dialog/CreateCategoryDialog";
import { DeleteCategoryDialog } from "../delete-category-dialog/DeleteCategoryDialog";
import { createCategoryUpdateQueue, resolveInlineCategoryNameEdit } from "./category-management.utils";

interface CategoryManagementProps {
  workspaceId: string;
}

function SortableCategoryItem({
  category,
  onUpdateName,
  onUpdateIcon,
  onStartDelete,
}: {
  category: Category;
  onUpdateName: (category: Category, name: string) => void;
  onUpdateIcon: (category: Category, selection: { icon: string | null; iconAssetId: string | null }) => void;
  onStartDelete: (category: Category) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  const [name, setName] = useState(category.name);
  const wasNameEditCancelledRef = useRef(false);

  useEffect(() => {
    setName(category.name);
  }, [category.name]);

  const commitName = () => {
    const resolvedEdit = resolveInlineCategoryNameEdit({
      categoryName: category.name,
      draftName: name,
      wasCancelled: wasNameEditCancelledRef.current,
    });
    wasNameEditCancelledRef.current = false;

    if (resolvedEdit.shouldReset) {
      setName(category.name);
    }

    if (resolvedEdit.nextName) {
      onUpdateName(category, resolvedEdit.nextName);
    }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center gap-2 rounded-md bg-control p-2 shadow-xs">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="group relative size-10 shrink-0">
          <CategoryIconPicker
            workspaceId={category.workspaceId}
            value={{ icon: category.icon, iconAssetId: category.iconAssetId }}
            onChange={(selection) => onUpdateIcon(category, selection)}
            className="border-0 bg-transparent hover:border-0 hover:bg-accent"
          />
          {(category.icon || category.iconAssetId) && (
            <button
              type="button"
              aria-label="Удалить иконку категории"
              title="Удалить иконку категории"
              onClick={() => onUpdateIcon(category, { icon: null, iconAssetId: null })}
              className="absolute -right-1 -top-1 z-20 flex size-4 items-center justify-center rounded-full bg-background text-muted-foreground opacity-0 shadow-sm transition-[color,background-color,opacity] group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-accent hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-control-focus/30"
            >
              <X className="size-2.5" />
            </button>
          )}
        </div>
        <div className="-ml-2 min-w-0 flex-1">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
                return;
              }

              if (event.key === "Escape") {
                event.preventDefault();
                wasNameEditCancelledRef.current = true;
                setName(category.name);
                event.currentTarget.blur();
              }
            }}
            className="h-8 text-sm"
            placeholder="Название категории"
            aria-label={`Название категории: ${category.name}`}
          />
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => onStartDelete(category)}
          className="shrink-0"
          aria-label="Удалить категорию"
          title="Удалить категорию"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function CategoryManagement({ workspaceId }: CategoryManagementProps) {
  const queryClient = useQueryClient();
  const deleteDialog = useDialogState<{
    categoryId: string;
    categoryName: string;
    categoryIcon: string | null;
    categoryIconAssetId: string | null;
    transactionCount: number;
  }>();
  const createCategoryDialog = useDialogState<{
    workspaceId: string;
    type: CategoryType;
  }>();
  const [selectedType, setSelectedType] = useState<CategoryType>(CategoryType.EXPENSE);
  const [incomeItems, setIncomeItems] = useState<Category[]>([]);
  const [expenseItems, setExpenseItems] = useState<Category[]>([]);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const incomeItemsRef = useRef<Category[]>([]);
  const expenseItemsRef = useRef<Category[]>([]);
  const pendingIncomeOrderRef = useRef<string | null>(null);
  const pendingExpenseOrderRef = useRef<string | null>(null);
  const queueCategoryUpdate = useRef(createCategoryUpdateQueue()).current;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: categoriesData } = useQuery({
    queryKey: categoryKeys.list(workspaceId),
    queryFn: () => getCategories(workspaceId),
    staleTime: 5000,
  });

  const categories = categoriesData?.data || [];
  const incomeCategories = categories.filter((c) => c.type === CategoryType.INCOME);
  const expenseCategories = categories.filter((c) => c.type === CategoryType.EXPENSE);

  useEffect(() => {
    incomeItemsRef.current = incomeItems;
  }, [incomeItems]);

  useEffect(() => {
    expenseItemsRef.current = expenseItems;
  }, [expenseItems]);

  useEffect(() => {
    if (incomeItems.length === 0 && incomeCategories.length > 0) {
      setIncomeItems(incomeCategories);
      return;
    }

    const currentIds = incomeItemsRef.current.map((item) => item.id).join(",");
    const newIds = incomeCategories.map((item) => item.id).join(",");

    const pendingOrder = pendingIncomeOrderRef.current;
    if (pendingOrder) {
      if (newIds === pendingOrder) {
        pendingIncomeOrderRef.current = null;
      } else if (currentIds === pendingOrder) {
        return;
      } else {
        pendingIncomeOrderRef.current = null;
      }
    }

    if (currentIds !== newIds) {
      setIncomeItems(incomeCategories);
      return;
    }

    const currentOrder = incomeItemsRef.current.map((item) => item.id).join(",");
    const newOrder = incomeCategories.map((item) => item.id).join(",");

    if (currentOrder === newOrder) {
      const updatedItems = incomeItemsRef.current.map((item) => {
        const updated = incomeCategories.find((c) => c.id === item.id);
        return updated || item;
      });
      const hasChanges = updatedItems.some((item, index) => {
        const current = incomeItemsRef.current[index];
        return (
          !current ||
          item.name !== current.name ||
          item.icon !== current.icon ||
          item.iconAssetId !== current.iconAssetId
        );
      });
      if (hasChanges) {
        setIncomeItems(updatedItems);
      }
    } else {
      setIncomeItems(incomeCategories);
    }
  }, [incomeCategories, incomeItems.length]);

  useEffect(() => {
    if (expenseItems.length === 0 && expenseCategories.length > 0) {
      setExpenseItems(expenseCategories);
      return;
    }

    const currentIds = expenseItemsRef.current.map((item) => item.id).join(",");
    const newIds = expenseCategories.map((item) => item.id).join(",");

    const pendingOrder = pendingExpenseOrderRef.current;
    if (pendingOrder) {
      if (newIds === pendingOrder) {
        pendingExpenseOrderRef.current = null;
      } else if (currentIds === pendingOrder) {
        return;
      } else {
        pendingExpenseOrderRef.current = null;
      }
    }

    if (currentIds !== newIds) {
      setExpenseItems(expenseCategories);
      return;
    }

    const currentOrder = expenseItemsRef.current.map((item) => item.id).join(",");
    const newOrder = expenseCategories.map((item) => item.id).join(",");

    if (currentOrder === newOrder) {
      const updatedItems = expenseItemsRef.current.map((item) => {
        const updated = expenseCategories.find((c) => c.id === item.id);
        return updated || item;
      });
      const hasChanges = updatedItems.some((item, index) => {
        const current = expenseItemsRef.current[index];
        return (
          !current ||
          item.name !== current.name ||
          item.icon !== current.icon ||
          item.iconAssetId !== current.iconAssetId
        );
      });
      if (hasChanges) {
        setExpenseItems(updatedItems);
      }
    } else {
      setExpenseItems(expenseCategories);
    }
  }, [expenseCategories, expenseItems.length]);

  const handleDragEnd = async (event: DragEndEvent, type: CategoryType) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const items = type === CategoryType.INCOME ? incomeItems : expenseItems;
      const setItems = type === CategoryType.INCOME ? setIncomeItems : setExpenseItems;
      const previousItems = [...items];

      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);

      const nextOrder = newItems.map((item) => item.id).join(",");
      if (type === CategoryType.INCOME) {
        pendingIncomeOrderRef.current = nextOrder;
      } else {
        pendingExpenseOrderRef.current = nextOrder;
      }

      const categoryOrderUpdates = newItems.map((category, index) => ({
        id: category.id,
        order: index,
      }));

      try {
        const result = await runOptimisticWorkspaceMutation({
          queryClient,
          workspaceId,
          domains: ["categories", "transactions"],
          apply: (context) => {
            updateCategoriesInCache(
              context,
              categoryOrderUpdates.map((item) => ({
                id: item.id,
                order: item.order,
              }))
            );
          },
          mutation: () =>
            updateCategoriesOrder(
              workspaceId,
              newItems.map((item) => item.id)
            ),
        });

        if (result.error) {
          toast.error(result.error);
          if (type === CategoryType.INCOME) {
            pendingIncomeOrderRef.current = null;
          } else {
            pendingExpenseOrderRef.current = null;
          }
          setItems(previousItems);
          return;
        }
      } catch {
        toast.error("Не удалось обновить порядок категорий");
        if (type === CategoryType.INCOME) {
          pendingIncomeOrderRef.current = null;
        } else {
          pendingExpenseOrderRef.current = null;
        }
        setItems(previousItems);
      }
    }
  };

  const updateCategoryFields = (categoryId: string, input: UpdateCategoryInput, errorMessage: string) => {
    void queueCategoryUpdate(categoryId, async () => {
      try {
        const result = await runOptimisticWorkspaceMutation({
          queryClient,
          workspaceId,
          domains: ["categories", "transactions"],
          apply: (context) => {
            updateCategoriesInCache(context, [{ id: categoryId, ...input }]);
          },
          mutation: () => updateCategory(categoryId, input),
        });

        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Категория обновлена");
        }
      } catch {
        toast.error(errorMessage);
      }
    });
  };

  const handleUpdateName = (category: Category, name: string) => {
    updateCategoryFields(category.id, { name }, "Не удалось обновить название категории");
  };

  const handleUpdateIcon = (category: Category, selection: { icon: string | null; iconAssetId: string | null }) => {
    updateCategoryFields(category.id, selection, "Не удалось обновить иконку категории");
  };

  const handleStartDelete = async (category: Category) => {
    const countResult = await getCategoryTransactionCount(category.id);
    if (countResult.error) {
      toast.error(countResult.error);
      return;
    }
    deleteDialog.openDialog({
      categoryId: category.id,
      categoryName: category.name,
      categoryIcon: category.icon,
      categoryIconAssetId: category.iconAssetId,
      transactionCount: countResult.data || 0,
    });
  };

  const handleConfirmDelete = () => {
    if (deleteDialog.mounted) {
      setIsDeletingCategory(true);
      const categoryId = deleteDialog.data.categoryId;

      void (async () => {
        try {
          const result = await runOptimisticWorkspaceMutation({
            queryClient,
            workspaceId,
            domains: ["categories", "transactions"],
            apply: (context) => {
              removeCategoriesFromCache(context, [categoryId]);
            },
            onApplied: () => {
              deleteDialog.closeDialog();
            },
            mutation: () => deleteCategory(categoryId),
          });

          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success("Категория удалена");
          }
        } catch {
          toast.error("Не удалось удалить категорию");
        } finally {
          setIsDeletingCategory(false);
        }
      })();
    }
  };

  const handleOpenCreateDialog = (type: CategoryType) => {
    createCategoryDialog.openDialog({
      workspaceId,
      type,
    });
  };

  const currentItems = selectedType === CategoryType.INCOME ? incomeItems : expenseItems;

  const renderCategoryList = (categoryList: Category[], type: CategoryType) => (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, type)}>
      <SortableContext items={categoryList.map((c) => c.id)}>
        <div className="space-y-1.5">
          {categoryList.map((category) => (
            <SortableCategoryItem
              key={category.id}
              category={category}
              onUpdateName={handleUpdateName}
              onUpdateIcon={handleUpdateIcon}
              onStartDelete={handleStartDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Категории</h3>
        <Segmented
          options={[
            {
              value: CategoryType.EXPENSE,
              label: "Расходы",
              selectedClassName: "text-destructive",
            },
            {
              value: CategoryType.INCOME,
              label: "Доходы",
              selectedClassName: "text-green-500",
            },
          ]}
          value={selectedType}
          onChange={(value) => setSelectedType(value as CategoryType)}
        />
      </div>

      <div>
        {renderCategoryList(currentItems, selectedType)}
        <Button variant="secondary" className="mt-4" onClick={() => handleOpenCreateDialog(selectedType)}>
          <Plus className="h-4 w-4 mr-2" />
          Добавить категорию
        </Button>
      </div>

      {createCategoryDialog.mounted && (
        <CreateCategoryDialog
          workspaceId={createCategoryDialog.data.workspaceId}
          type={createCategoryDialog.data.type}
          open={createCategoryDialog.open}
          onOpenChange={createCategoryDialog.closeDialog}
        />
      )}

      {deleteDialog.mounted && (
        <DeleteCategoryDialog
          open={deleteDialog.open}
          onOpenChange={deleteDialog.closeDialog}
          categoryName={deleteDialog.data.categoryName}
          categoryIcon={deleteDialog.data.categoryIcon}
          categoryIconAssetId={deleteDialog.data.categoryIconAssetId}
          transactionCount={deleteDialog.data.transactionCount}
          onConfirm={handleConfirmDelete}
          isDeleting={isDeletingCategory}
        />
      )}
    </div>
  );
}
