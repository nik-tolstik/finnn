import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CreditCard, Plus, Search, WalletCards } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { NumberInput } from "@/shared/ui/number-input";
import { Segmented } from "@/shared/ui/segmented";
import { Select } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Textarea } from "@/shared/ui/textarea";

const meta = {
  title: "Shared UI/Overview",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

function SharedUiGallery() {
  const [mode, setMode] = useState("cards");
  const [currency, setCurrency] = useState("RUB");
  const [includeArchived, setIncludeArchived] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
          <CardDescription>Core buttons, fields, badges and segmented controls.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Button>
              <Plus className="size-4" />
              Добавить
            </Button>
            <Button variant="secondary">
              <Search className="size-4" />
              Найти
            </Button>
            <Button variant="secondary">Вторичная</Button>
            <Button variant="ghost">Ссылка</Button>
            <Button variant="destructive">Удалить</Button>
            <Button size="icon" aria-label="Cards">
              <WalletCards className="size-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge>Активно</Badge>
            <Badge variant="secondary">Общее</Badge>
            <Badge variant="outline">Черновик</Badge>
            <Badge variant="destructive">Ошибка</Badge>
          </div>

          <Segmented
            value={mode}
            onChange={setMode}
            layout="fill"
            options={[
              { value: "cards", label: "Карточки", icon: <WalletCards /> },
              { value: "list", label: "Список", icon: <CreditCard /> },
            ]}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Название счёта" defaultValue="Основная карта" />
            <NumberInput placeholder="Сумма" defaultValue="1250.50" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              multiple={false}
              value={currency}
              onChange={setCurrency}
              placeholder="Валюта"
              options={[
                { value: "RUB", label: "RUB" },
                { value: "USD", label: "USD" },
                { value: "EUR", label: "EUR" },
              ]}
            />
            <div className="flex min-h-9 items-center gap-2 rounded-md bg-control px-3 text-sm shadow-xs">
              <Checkbox
                checked={includeArchived}
                onCheckedChange={setIncludeArchived}
                aria-label="Показывать архивные счета"
              />
              Показывать архивные счета
            </div>
          </div>

          <Textarea placeholder="Описание" defaultValue="Регулярные расходы и личные покупки." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Loading</CardTitle>
          <CardDescription>Skeleton blocks for dense finance surfaces.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/5" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const Overview: Story = {
  render: () => <SharedUiGallery />,
};

export const DenseTable: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Recent movements</CardTitle>
        <CardDescription>Table primitives for compact financial lists.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Счёт</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              ["06.07", "Продукты", "Основная карта", "-8 420 ₽"],
              ["05.07", "Зарплата", "Основная карта", "+245 000 ₽"],
              ["04.07", "Накопления", "EUR сейф", "+500 €"],
            ].map(([date, category, account, amount]) => (
              <TableRow key={`${date}-${category}`}>
                <TableCell>{date}</TableCell>
                <TableCell>{category}</TableCell>
                <TableCell>{account}</TableCell>
                <TableCell className="text-right font-medium">{amount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  ),
};
