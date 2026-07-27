"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Search, X } from "lucide-react";
import Image from "next/image";
import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { deleteCategoryIcon, getCategoryIcons, uploadCategoryIcon } from "@/modules/categories/category.api";
import type { CategoryIconAsset } from "@/modules/categories/category.types";
import { CategoryIcon } from "@/shared/components/category-icon";
import { CATEGORY_EMOJI_GROUPS, filterCategoryEmojiGroups } from "@/shared/constants/category-emojis";
import { useBreakpoints } from "@/shared/hooks/useBreakpoints";
import { categoryIconKeys } from "@/shared/lib/query-keys";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Popover } from "@/shared/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import { cn } from "@/shared/utils/cn";

import { resolveCategoryIconUploadSelection } from "./category-icon-picker.utils";

export type CategoryIconSelection = {
  icon: string | null;
  iconAssetId: string | null;
};

export interface CategoryIconPickerProps {
  workspaceId: string;
  value: CategoryIconSelection;
  onChange: (value: CategoryIconSelection) => void;
  disabled?: boolean;
  className?: string;
}

type DeleteCategoryIconContext = {
  previousAssets: CategoryIconAsset[] | undefined;
};

function IconButton({
  selected,
  children,
  label,
  onClick,
}: {
  selected: boolean;
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      title={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-lg text-xl transition-colors hover:bg-accent"
    >
      {children}
    </button>
  );
}

function PickerTabs({
  assets,
  value,
  onSelect,
  onUpload,
  uploadPending,
  onClear,
  onDeleteAsset,
  deletePendingAssetId,
}: {
  assets: CategoryIconAsset[];
  value: CategoryIconSelection;
  onSelect: (selection: CategoryIconSelection) => void;
  onUpload: (file: File) => void;
  uploadPending: boolean;
  onClear: () => void;
  onDeleteAsset: (asset: CategoryIconAsset) => void;
  deletePendingAssetId: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    const selection = resolveCategoryIconUploadSelection(file);
    setUploadError(selection.error);
    setSelectedFile(selection.selectedFile);
  };

  const handleUpload = () => {
    if (selectedFile) onUpload(selectedFile);
  };

  const filteredGroups = useMemo(() => filterCategoryEmojiGroups(CATEGORY_EMOJI_GROUPS, search), [search]);

  return (
    <Tabs.Root defaultValue="icons" className="flex min-h-0 max-h-[calc(55vh-4rem)] flex-col sm:max-h-[20rem]">
      <Tabs.List className="grid grid-cols-2 border-b border-border px-4">
        <Tabs.Trigger
          value="icons"
          className="border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
        >
          Иконки
        </Tabs.Trigger>
        <Tabs.Trigger
          value="upload"
          className="border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
        >
          Загрузить
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="icons" className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 outline-none">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск"
          prefix={<Search className="size-4" />}
          aria-label="Поиск иконок"
        />

        {assets.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Загруженные</h3>
            <div className="flex flex-wrap gap-2">
              {assets.map((asset) => {
                const isCurrentAsset = value.iconAssetId === asset.id;
                const isDeleting = deletePendingAssetId === asset.id;
                const deleteLabel = isCurrentAsset ? "Удалить иконку категории" : "Удалить загруженную иконку";

                return (
                  <div key={asset.id} className="flex w-11 flex-col items-center gap-1">
                    <div className="group relative size-11">
                      <IconButton
                        label="Загруженная иконка"
                        selected={isCurrentAsset}
                        onClick={() => onSelect({ icon: null, iconAssetId: asset.id })}
                      >
                        <CategoryIcon iconAssetId={asset.id} iconAssetUrl={asset.url} className="size-6 rounded-md" />
                      </IconButton>
                      <button
                        type="button"
                        aria-label={deleteLabel}
                        title={deleteLabel}
                        disabled={isDeleting}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (isCurrentAsset) {
                            onClear();
                          } else {
                            onDeleteAsset(asset);
                          }
                        }}
                        className="absolute right-0 top-0 flex size-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground opacity-0 shadow-sm transition-[color,background-color,opacity] group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-accent hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-control-focus/30 disabled:pointer-events-none disabled:opacity-50"
                      >
                        {isDeleting ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {filteredGroups.map((group) => (
          <section key={group.label} className="space-y-2">
            <h3 className="text-sm font-medium">{group.label}</h3>
            <div className="flex flex-wrap gap-2">
              {group.emojis.map((item) => (
                <IconButton
                  key={item.emoji}
                  label={item.tags[0] || item.emoji}
                  selected={value.icon === item.emoji && !value.iconAssetId}
                  onClick={() => onSelect({ icon: item.emoji, iconAssetId: null })}
                >
                  {item.emoji}
                </IconButton>
              ))}
            </div>
          </section>
        ))}

        {filteredGroups.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Ничего не найдено</p>
        )}
      </Tabs.Content>

      <Tabs.Content value="upload" className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 outline-none">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="rounded-xl border border-dashed border-border p-3 text-center">
          <ImagePlus className="mx-auto mb-2 size-7 text-muted-foreground" />
          <p className="text-sm font-medium">Загрузите изображение категории</p>
          <p className="mt-1 text-xs text-muted-foreground">PNG, JPEG или WebP до 2 MB</p>
          {selectedFile && previewUrl ? (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2 text-left">
                <div className="relative flex h-16 items-center justify-center rounded-lg bg-white p-2 text-slate-900">
                  <Image
                    src={previewUrl}
                    alt="Предпросмотр иконки в светлой теме"
                    fill
                    unoptimized
                    className="object-contain p-2"
                  />
                </div>
                <div className="relative flex h-16 items-center justify-center rounded-lg bg-[var(--palette-dark-900)] p-2 text-white">
                  <Image
                    src={previewUrl}
                    alt="Предпросмотр иконки в тёмной теме"
                    fill
                    unoptimized
                    className="object-contain p-2"
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setSelectedFile(null)}>
                  Назад
                </Button>
                <Button type="button" className="flex-1" disabled={uploadPending} onClick={handleUpload}>
                  {uploadPending && <Loader2 className="size-4 animate-spin" />}
                  {uploadPending ? "Сохранение..." : "Сохранить"}
                </Button>
              </div>
            </>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              disabled={uploadPending}
              onClick={() => fileInputRef.current?.click()}
            >
              Выбрать файл
            </Button>
          )}
        </div>
        {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
      </Tabs.Content>
    </Tabs.Root>
  );
}

export function CategoryIconPicker({ workspaceId, value, onChange, disabled, className }: CategoryIconPickerProps) {
  const { isMobile } = useBreakpoints();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const iconQueryKey = categoryIconKeys.list(workspaceId);

  const iconsQuery = useQuery({
    queryKey: iconQueryKey,
    queryFn: async () => {
      const result = await getCategoryIcons(workspaceId);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled: open,
    staleTime: 30_000,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadCategoryIcon(workspaceId, file),
    onSuccess: (result) => {
      if (result.error || !result.data) {
        toast.error(result.error || "Не удалось загрузить иконку");
        return;
      }

      queryClient.setQueryData<CategoryIconAsset[]>(iconQueryKey, (current) => [
        result.data as CategoryIconAsset,
        ...(current ?? []).filter((asset) => asset.id !== result.data?.id),
      ]);
      onChange({ icon: null, iconAssetId: result.data.id });
      setOpen(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Не удалось загрузить иконку"),
  });

  const deleteMutation = useMutation({
    mutationFn: (assetId: string) => deleteCategoryIcon(assetId),
    onMutate: async (assetId): Promise<DeleteCategoryIconContext> => {
      await queryClient.cancelQueries({ queryKey: iconQueryKey });
      const previousAssets = queryClient.getQueryData<CategoryIconAsset[]>(iconQueryKey);
      queryClient.setQueryData<CategoryIconAsset[]>(iconQueryKey, (current) =>
        (current ?? []).filter((asset) => asset.id !== assetId)
      );
      return { previousAssets };
    },
    onSuccess: (result, _assetId, context) => {
      if (result.error) {
        queryClient.setQueryData(iconQueryKey, context?.previousAssets);
        toast.error(result.error);
      }
    },
    onError: (error, _assetId, context) => {
      queryClient.setQueryData(iconQueryKey, context?.previousAssets);
      toast.error(error instanceof Error ? error.message : "Не удалось удалить иконку");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: iconQueryKey });
    },
  });

  const content = (
    <PickerTabs
      assets={iconsQuery.data ?? []}
      value={value}
      onSelect={(selection) => {
        onChange(selection);
        setOpen(false);
      }}
      onUpload={(file) => uploadMutation.mutate(file)}
      uploadPending={uploadMutation.isPending}
      onClear={() => {
        onChange({ icon: null, iconAssetId: null });
        setOpen(false);
      }}
      onDeleteAsset={(asset) => deleteMutation.mutate(asset.id)}
      deletePendingAssetId={deleteMutation.isPending ? (deleteMutation.variables ?? null) : null}
    />
  );

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          disabled={disabled}
          aria-label="Выбрать иконку категории"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-control text-xl transition-colors hover:border-primary/50 hover:bg-accent disabled:pointer-events-none disabled:opacity-50",
            className
          )}
        >
          <CategoryIcon icon={value.icon} iconAssetId={value.iconAssetId} className="size-5" />
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="max-h-[55vh] gap-0 p-0">
            <SheetHeader className="px-4 pb-3">
              <SheetTitle>Иконка категории</SheetTitle>
            </SheetHeader>
            {content}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      className="w-[min(22rem,calc(100vw-1rem))] overflow-hidden p-0"
      trigger={({ ref, className: popoverTriggerClassName, ...triggerProps }) => (
        <button
          {...triggerProps}
          ref={ref}
          type="button"
          disabled={disabled}
          aria-label="Выбрать иконку категории"
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-control text-xl transition-colors hover:border-primary/50 hover:bg-accent disabled:pointer-events-none disabled:opacity-50",
            className,
            popoverTriggerClassName
          )}
        >
          <CategoryIcon icon={value.icon} iconAssetId={value.iconAssetId} className="size-5" />
        </button>
      )}
    >
      {content}
    </Popover>
  );
}
