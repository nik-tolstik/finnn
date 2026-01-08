"use client";

import type { Category } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CategoryType } from "@/modules/categories/category.constants";
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
import { cn } from "@/shared/utils/cn";

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
    type: CategoryType;
  }>();
  const [editingName, setEditingName] = useState("");
  const [editingColor, setEditingColor] = useState("");

  const { data: categoriesData } = useQuery({
    queryKey: ["categories", workspaceId],
    queryFn: () => getCategories(workspaceId),
    staleTime: 5000,
    refetchInterval: 5000,
  });

  const categories = categoriesData?.data || [];
  const incomeCategories = categories.filter((c) => c.type === CategoryType.INCOME);
  const expenseCategories = categories.filter((c) => c.type === CategoryType.EXPENSE);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; color?: string } }) => updateCategory(id, data),
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

  const handleOpenCreateDialog = (type: CategoryType) => {
    createCategoryDialog.openDialog({
      workspaceId,
      type,
    });
  };

  const renderCategoryList = (categoryList: Category[], _type: CategoryType) => (
    <div className="space-y-1.5">
      {categoryList.map((category) => (
        <div key={category.id} className="p-2 border rounded-md">
          {editingCategory?.id === category.id ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded border shrink-0" style={{ backgroundColor: editingColor }} />
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
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Цвет</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditingColor(color)}
                      className={cn(
                        "h-6 w-6 rounded-md border-2 transition-all",
                        editingColor === color ? "border-primary scale-110" : "border-border hover:border-primary/50"
                      )}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div
                className="h-6 w-6 rounded border shrink-0"
                style={{ backgroundColor: category.color || undefined }}
              />
              <span className="flex-1 text-sm font-medium">{category.name}</span>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => handleStartEdit(category)} className="h-7 w-7 p-0">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleStartDelete(category)} className="h-7 w-7 p-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Доходы</h3>
        {renderCategoryList(incomeCategories, CategoryType.INCOME)}
        <Button variant="outline" className="mt-4" onClick={() => handleOpenCreateDialog(CategoryType.INCOME)}>
          <Plus className="h-4 w-4 mr-2" />
          Добавить категорию
        </Button>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Расходы</h3>
        {renderCategoryList(expenseCategories, CategoryType.EXPENSE)}
        <Button variant="outline" className="mt-4" onClick={() => handleOpenCreateDialog(CategoryType.EXPENSE)}>
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
