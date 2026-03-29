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
import type { Category } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CategoryType } from "@/modules/categories/category.constants";
import {
  deleteCategory,
  getCategories,
  getCategoryTransactionCount,
  updateCategoriesOrder,
  updateCategory,
} from "@/modules/categories/category.service";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { categoryKeys } from "@/shared/lib/query-keys";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Segmented } from "@/shared/ui/segmented";
import { cn } from "@/shared/utils/cn";

import { CreateCategoryDialog } from "./CreateCategoryDialog";
import { DeleteCategoryDialog } from "./DeleteCategoryDialog";

interface CategoryManagementProps {
  workspaceId: string;
}

function SortableCategoryItem({
  category,
  editingCategory,
  editingName,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onStartDelete,
  updateMutation,
  setEditingName,
}: {
  category: Category;
  editingCategory: Category | null;
  editingName: string;
  onStartEdit: (category: Category) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onStartDelete: (category: Category) => void;
  updateMutation: any;
  setEditingName: (name: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    disabled: !!editingCategory,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="p-2 border rounded-md">
        {editingCategory?.id === category.id ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="flex-1 h-8 text-sm"
                placeholder="Название категории"
              />
              <div className="flex gap-1.5 shrink-0">
                <Button
                  size="sm"
                  onClick={onSaveEdit}
                  disabled={updateMutation.isPending || !editingName.trim()}
                  className="h-8 text-xs px-2"
                >
                  Сохранить
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onCancelEdit}
                  disabled={updateMutation.isPending}
                  className="h-8 text-xs px-2"
                >
                  Отмена
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div
              {...attributes}
              {...listeners}
              className={cn(
                "cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors",
                editingCategory && "cursor-not-allowed opacity-50"
              )}
            >
              <GripVertical className="h-4 w-4" />
            </div>
            <span className="flex-1 text-sm font-medium">{category.name}</span>
            <div className="flex gap-1 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => onStartEdit(category)} className="h-7 w-7 p-0">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onStartDelete(category)} className="h-7 w-7 p-0">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function CategoryManagement({ workspaceId }: CategoryManagementProps) {
  const queryClient = useQueryClient();
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const deleteDialog = useDialogState<{
    categoryId: string;
    categoryName: string;
    transactionCount: number;
  }>();
  const createCategoryDialog = useDialogState<{
    workspaceId: string;
    type: CategoryType;
  }>();
  const [editingName, setEditingName] = useState("");
  const [selectedType, setSelectedType] = useState<CategoryType>(CategoryType.EXPENSE);
  const [incomeItems, setIncomeItems] = useState<Category[]>([]);
  const [expenseItems, setExpenseItems] = useState<Category[]>([]);
  const incomeItemsRef = useRef<Category[]>([]);
  const expenseItemsRef = useRef<Category[]>([]);

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
        return !current || item.name !== current.name;
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
        return !current || item.name !== current.name;
      });
      if (hasChanges) {
        setExpenseItems(updatedItems);
      }
    } else {
      setExpenseItems(expenseCategories);
    }
  }, [expenseCategories, expenseItems.length]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string } }) => updateCategory(id, data),
    onSuccess: async (result) => {
      if (result.error) {
        toast.error(result.error);
      } else {
        await invalidateWorkspaceDomains(queryClient, workspaceId, ["categories", "transactions"]);
        setEditingCategory(null);
        setEditingName("");
      }
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: (categoryIds: string[]) => updateCategoriesOrder(workspaceId, categoryIds),
    onSuccess: async (result) => {
      if (result.error) {
        toast.error(result.error);
        await invalidateWorkspaceDomains(queryClient, workspaceId, ["categories", "transactions"]);
        return;
      }

      await invalidateWorkspaceDomains(queryClient, workspaceId, ["categories", "transactions"]);
    },
    onError: async () => {
      await invalidateWorkspaceDomains(queryClient, workspaceId, ["categories", "transactions"]);
    },
  });

  const handleDragEnd = (event: DragEndEvent, type: CategoryType) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const items = type === CategoryType.INCOME ? incomeItems : expenseItems;
      const setItems = type === CategoryType.INCOME ? setIncomeItems : setExpenseItems;

      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);

      const orderedItems = newItems.map((category, index) => ({
        ...category,
        order: index,
      }));

      const updatedCategories = [...categories.filter((cat) => cat.type !== type), ...orderedItems];

      queryClient.setQueryData(categoryKeys.list(workspaceId), { data: updatedCategories });

      updateOrderMutation.mutate(newItems.map((item) => item.id));
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: async (result) => {
      if (result.error) {
        toast.error(result.error);
      } else {
        await invalidateWorkspaceDomains(queryClient, workspaceId, ["categories", "transactions"]);
      }
      deleteDialog.closeDialog();
    },
  });

  const handleStartEdit = (category: Category) => {
    setEditingCategory(category);
    setEditingName(category.name);
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setEditingName("");
  };

  const handleSaveEdit = () => {
    if (!editingCategory) return;
    updateMutation.mutate({
      id: editingCategory.id,
      data: {
        name: editingName,
      },
    });
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
      transactionCount: countResult.data || 0,
    });
  };

  const handleConfirmDelete = () => {
    if (deleteDialog.mounted) {
      deleteMutation.mutate(deleteDialog.data.categoryId);
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
              editingCategory={editingCategory}
              editingName={editingName}
              onStartEdit={handleStartEdit}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={handleSaveEdit}
              onStartDelete={handleStartDelete}
              updateMutation={updateMutation}
              setEditingName={setEditingName}
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
              icon: <ArrowDown className="h-4 w-4" />,
              selectedClassName: "text-destructive",
            },
            {
              value: CategoryType.INCOME,
              label: "Доходы",
              icon: <ArrowUp className="h-4 w-4" />,
              selectedClassName: "text-green-500",
            },
          ]}
          value={selectedType}
          onChange={(value) => setSelectedType(value as CategoryType)}
        />
      </div>

      <div>
        {renderCategoryList(currentItems, selectedType)}
        <Button variant="outline" className="mt-4" onClick={() => handleOpenCreateDialog(selectedType)}>
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
          transactionCount={deleteDialog.data.transactionCount}
          onConfirm={handleConfirmDelete}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
