"use client";

import type { Category } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  deleteCategory,
  getCategories,
  getCategoryTransactionCount,
  updateCategory,
} from "@/modules/categories/category.service";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { CATEGORY_COLORS } from "@/shared/utils/category-colors";

import { CreateCategoryDialog } from "./CreateCategoryDialog";
import { DeleteCategoryDialog } from "./DeleteCategoryDialog";

interface CategoryManagementProps {
  workspaceId: string;
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
    type: "income" | "expense";
  }>();
  const [editingName, setEditingName] = useState("");
  const [editingColor, setEditingColor] = useState("");

  const { data: categoriesData } = useQuery({
    queryKey: ["categories", workspaceId],
    queryFn: () => getCategories(workspaceId),
  });

  const categories = categoriesData?.data || [];
  const incomeCategories = categories.filter((c) => c.type === "income");
  const expenseCategories = categories.filter((c) => c.type === "expense");

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; color?: string } }) =>
      updateCategory(id, data),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Категория обновлена");
        queryClient.invalidateQueries({ queryKey: ["categories", workspaceId] });
        setEditingCategory(null);
        setEditingName("");
        setEditingColor("");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Категория удалена");
        queryClient.invalidateQueries({ queryKey: ["categories", workspaceId] });
      }
      deleteDialog.closeDialog();
    },
  });

  const handleStartEdit = (category: Category) => {
    setEditingCategory(category);
    setEditingName(category.name);
    setEditingColor(category.color || CATEGORY_COLORS[0]);
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setEditingName("");
    setEditingColor("");
  };

  const handleSaveEdit = () => {
    if (!editingCategory) return;
    updateMutation.mutate({
      id: editingCategory.id,
      data: {
        name: editingName,
        color: editingColor,
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

  const handleOpenCreateDialog = (type: "income" | "expense") => {
    createCategoryDialog.openDialog({
      workspaceId,
      type,
    });
  };

  const renderCategoryList = (
    categoryList: Category[],
    type: "income" | "expense"
  ) => (
    <div className="space-y-1.5">
      {categoryList.map((category) => (
        <div
          key={category.id}
          className="flex items-center gap-2 p-2 border rounded-md"
        >
          {editingCategory?.id === category.id ? (
            <>
              <div
                className="h-6 w-6 rounded border shrink-0"
                style={{ backgroundColor: editingColor }}
              />
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="flex-1 h-8 text-sm"
                placeholder="Название категории"
              />
              <div className="flex gap-1.5 shrink-0">
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={updateMutation.isPending || !editingName.trim()}
                  className="h-8 text-xs px-2"
                >
                  Сохранить
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={updateMutation.isPending}
                  className="h-8 text-xs px-2"
                >
                  Отмена
                </Button>
              </div>
            </>
          ) : (
            <>
              <div
                className="h-6 w-6 rounded border shrink-0"
                style={{ backgroundColor: category.color || undefined }}
              />
              <span className="flex-1 text-sm font-medium">{category.name}</span>
              <div className="flex gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleStartEdit(category)}
                  className="h-7 w-7 p-0"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleStartDelete(category)}
                  className="h-7 w-7 p-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Доходы</h3>
        {renderCategoryList(incomeCategories, "income")}
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => handleOpenCreateDialog("income")}
        >
          <Plus className="h-4 w-4 mr-2" />
          Добавить категорию
        </Button>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Расходы</h3>
        {renderCategoryList(expenseCategories, "expense")}
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => handleOpenCreateDialog("expense")}
        >
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

