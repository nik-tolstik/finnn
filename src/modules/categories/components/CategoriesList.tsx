"use client";

import type { Category } from "@prisma/client";
import { Tag } from "lucide-react";

import { Badge } from "@/shared/ui/badge";

interface CategoriesListProps {
  categories: Category[];
}

export function CategoriesList({ categories }: CategoriesListProps) {
  if (categories.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Нет категорий. Создайте первую категорию, чтобы начать.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => (
        <Badge
          key={category.id}
          variant="outline"
          className="flex items-center gap-2 px-3 py-1.5 font-normal"
          style={{
            borderColor: category.color || undefined,
          }}
        >
          {category.icon ? <span className="text-sm">{category.icon}</span> : <Tag className="h-3 w-3" />}
          <span>{category.name}</span>
        </Badge>
      ))}
    </div>
  );
}
