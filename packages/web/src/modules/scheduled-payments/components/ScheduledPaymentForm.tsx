"use client";

import { ru } from "date-fns/locale";
import { Bell, CalendarClock, ChevronRight, Clock3, Mail, Repeat2, Send } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import type { Account } from "@/modules/accounts/account.types";
import type { Category } from "@/modules/categories/category.types";
import { AccountSelector } from "@/shared/components/AccountSelector";
import { UserAvatar } from "@/shared/components/UserAvatar";
import { CURRENCY_OPTIONS, type Currency, DEFAULT_CURRENCY } from "@/shared/constants/currency";
import { useBreakpoints } from "@/shared/hooks/useBreakpoints";
import { useSession } from "@/shared/lib/api-session-client";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { DateTimePicker } from "@/shared/ui/date-time-picker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { NumberInput } from "@/shared/ui/number-input";
import { Popover } from "@/shared/ui/popover";
import { type RenderOptionProps, Select, type SelectOption } from "@/shared/ui/select";
import { Tooltip } from "@/shared/ui/tooltip";
import { cn } from "@/shared/utils/cn";

import { DEFAULT_REMINDER_DAYS } from "../scheduled-payment.constants";
import type { ScheduledPayment, ScheduledPaymentFormInput } from "../scheduled-payment.types";

type MemberOption = {
  id: string;
  name: string | null;
  email?: string | null;
  image: string | null;
  notificationChannels?: NotificationChannelAvailability;
};

type NotificationChannelAvailability = {
  email: boolean;
  telegram: boolean;
};

interface ScheduledPaymentFormProps {
  accounts: Account[];
  baseCurrency?: string;
  categories: Category[];
  initialPayment?: ScheduledPayment | null;
  members: MemberOption[];
  onCloseComplete?: () => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: ScheduledPaymentFormInput) => Promise<void>;
  open: boolean;
  workspaceId: string;
}

const FIELD_CLASS = "space-y-1.5";

const SCHEDULE_KIND_OPTIONS = [
  { value: "one_time", label: "Разово" },
  { value: "weekly", label: "Еженедельно" },
  { value: "monthly", label: "Ежемесячно" },
  { value: "yearly", label: "Ежегодно" },
  { value: "custom", label: "Интервал" },
] satisfies SelectOption<ScheduledPaymentFormInput["scheduleKind"]>[];

const REPEAT_SELECT_OPTIONS = SCHEDULE_KIND_OPTIONS.map((option) =>
  option.value === "one_time" ? { ...option, label: "Не повторять" } : option
);

const SCHEDULE_UNIT_OPTIONS = [
  { value: "days", label: "Дни" },
  { value: "weeks", label: "Недели" },
  { value: "months", label: "Месяцы" },
  { value: "years", label: "Годы" },
] satisfies SelectOption<NonNullable<ScheduledPaymentFormInput["scheduleUnit"]>>[];

type ScheduleKind = ScheduledPaymentFormInput["scheduleKind"];
type ScheduleUnit = NonNullable<ScheduledPaymentFormInput["scheduleUnit"]>;

function toCurrency(value?: string | null): Currency {
  return CURRENCY_OPTIONS.some((option) => option.value === value) ? (value as Currency) : DEFAULT_CURRENCY;
}

function formatScheduleDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getReminderLabel(day: number) {
  if (day === 0) return "В день оплаты";
  return `За ${day} дн.`;
}

function getRemindersLabel(reminders: number[]) {
  if (reminders.length === 0) return "Без уведомлений";
  return [...reminders]
    .sort((a, b) => b - a)
    .map(getReminderLabel)
    .join(", ");
}

function getRepeatLabel(scheduleKind: ScheduleKind, scheduleInterval: number, scheduleUnit: ScheduleUnit) {
  if (scheduleKind === "one_time") return "Не повторять";

  if (scheduleKind !== "custom") {
    return SCHEDULE_KIND_OPTIONS.find((option) => option.value === scheduleKind)?.label ?? scheduleKind;
  }

  const unitLabel = SCHEDULE_UNIT_OPTIONS.find((option) => option.value === scheduleUnit)?.label.toLowerCase() ?? "дни";
  return `Каждые ${scheduleInterval} ${unitLabel}`;
}

interface ScheduleSettingsDropdownProps {
  notificationChannels: NotificationChannelAvailability;
  nextDueAt: Date;
  notifyEmail: boolean;
  notifyTelegram: boolean;
  reminderDaysBefore: number[];
  scheduleInterval: number;
  scheduleKind: ScheduleKind;
  scheduleUnit: ScheduleUnit;
  onNextDueAtChange: (date: Date) => void;
  onNotifyEmailChange: (value: boolean) => void;
  onNotifyTelegramChange: (value: boolean) => void;
  onReminderDaysBeforeChange: (value: number[]) => void;
  onScheduleIntervalChange: (value: number) => void;
  onScheduleKindChange: (value: ScheduleKind) => void;
  onScheduleUnitChange: (value: ScheduleUnit) => void;
}

function ScheduleSettingsDropdown({
  notificationChannels,
  nextDueAt,
  notifyEmail,
  notifyTelegram,
  reminderDaysBefore,
  scheduleInterval,
  scheduleKind,
  scheduleUnit,
  onNextDueAtChange,
  onNotifyEmailChange,
  onNotifyTelegramChange,
  onReminderDaysBeforeChange,
  onScheduleIntervalChange,
  onScheduleKindChange,
  onScheduleUnitChange,
}: ScheduleSettingsDropdownProps) {
  const { isMobile } = useBreakpoints();
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(nextDueAt);
  const [draftNotifyEmail, setDraftNotifyEmail] = useState(notifyEmail);
  const [draftNotifyTelegram, setDraftNotifyTelegram] = useState(notifyTelegram);
  const [draftReminderDays, setDraftReminderDays] = useState(reminderDaysBefore);
  const [draftScheduleKind, setDraftScheduleKind] = useState(scheduleKind);
  const [draftScheduleInterval, setDraftScheduleInterval] = useState(scheduleInterval);
  const [draftScheduleUnit, setDraftScheduleUnit] = useState(scheduleUnit);
  const emailDisabledReason = notificationChannels.email ? null : "У ответственного нет подтверждённого email";
  const telegramDisabledReason = notificationChannels.telegram
    ? null
    : "Ответственный должен открыть бота Finnn в Telegram, чтобы получать уведомления";

  useEffect(() => {
    if (!open) return;

    setDraftDate(nextDueAt);
    setDraftNotifyEmail(notificationChannels.email && notifyEmail);
    setDraftNotifyTelegram(notificationChannels.telegram && notifyTelegram);
    setDraftReminderDays(reminderDaysBefore);
    setDraftScheduleKind(scheduleKind);
    setDraftScheduleInterval(scheduleInterval);
    setDraftScheduleUnit(scheduleUnit);
  }, [
    nextDueAt,
    notificationChannels.email,
    notificationChannels.telegram,
    notifyEmail,
    notifyTelegram,
    open,
    reminderDaysBefore,
    scheduleInterval,
    scheduleKind,
    scheduleUnit,
  ]);

  const triggerLabel = `${formatScheduleDate(nextDueAt)} · ${getRepeatLabel(scheduleKind, scheduleInterval, scheduleUnit)}`;

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) return;
    const nextDate = new Date(selectedDate);
    nextDate.setHours(draftDate.getHours(), draftDate.getMinutes(), 0, 0);
    setDraftDate(nextDate);
  };

  const handleApply = () => {
    onNextDueAtChange(draftDate);
    onNotifyEmailChange(notificationChannels.email && draftNotifyEmail);
    onNotifyTelegramChange(notificationChannels.telegram && draftNotifyTelegram);
    onReminderDaysBeforeChange(draftReminderDays);
    onScheduleKindChange(draftScheduleKind);
    onScheduleIntervalChange(Math.max(1, draftScheduleInterval));
    onScheduleUnitChange(draftScheduleUnit);
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const settingsBody = (
    <div className={cn("overflow-hidden bg-background", isMobile ? "rounded-none" : "rounded-2xl")}>
      <Calendar
        mode="single"
        locale={ru}
        selected={draftDate}
        defaultMonth={draftDate}
        onSelect={handleDateSelect}
        className="mx-auto bg-background p-3"
        classNames={{
          month_caption: "flex h-8 items-center justify-start px-0 text-sm font-medium",
          nav: "absolute top-0 right-0 flex w-auto items-center gap-1",
        }}
      />

      <div className="border-t px-4 py-2">
        <div className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Clock3 className="size-4" />
            Срок исполнения
          </span>
          <DateTimePicker
            date={draftDate}
            onSelect={(date) => {
              if (date) setDraftDate(date);
            }}
            showDate={false}
          />
        </div>

        <div className="space-y-2 py-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <Bell className="size-4" />
              Уведомление
            </span>
            <span className="truncate text-right text-xs text-muted-foreground">
              {getRemindersLabel(draftReminderDays)}
            </span>
          </div>
          <div className="flex gap-1.5">
            <Tooltip content={emailDisabledReason} disabled={!emailDisabledReason}>
              <span className={cn("flex-1", emailDisabledReason && "cursor-not-allowed")}>
                <button
                  type="button"
                  disabled={Boolean(emailDisabledReason)}
                  onClick={() => setDraftNotifyEmail((current) => !current)}
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors disabled:pointer-events-none disabled:opacity-45",
                    draftNotifyEmail
                      ? "border-primary bg-primary/10 text-primary"
                      : "bg-background text-muted-foreground hover:bg-accent disabled:hover:bg-background"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors",
                      draftNotifyEmail
                        ? "border-primary/30 bg-primary text-primary-foreground"
                        : "border-border bg-muted text-muted-foreground"
                    )}
                  >
                    <Mail className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">Email</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {draftNotifyEmail ? "Включён" : "Выключен"}
                    </span>
                  </span>
                </button>
              </span>
            </Tooltip>
            <Tooltip content={telegramDisabledReason} disabled={!telegramDisabledReason}>
              <span className={cn("flex-1", telegramDisabledReason && "cursor-not-allowed")}>
                <button
                  type="button"
                  disabled={Boolean(telegramDisabledReason)}
                  onClick={() => setDraftNotifyTelegram((current) => !current)}
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors disabled:pointer-events-none disabled:opacity-45",
                    draftNotifyTelegram
                      ? "border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                      : "bg-background text-muted-foreground hover:bg-accent disabled:hover:bg-background"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors",
                      draftNotifyTelegram
                        ? "border-sky-500/30 bg-sky-500 text-white"
                        : "border-border bg-muted text-muted-foreground"
                    )}
                  >
                    <Send className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">Telegram</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {draftNotifyTelegram ? "Включён" : "Выключен"}
                    </span>
                  </span>
                </button>
              </span>
            </Tooltip>
          </div>
        </div>

        <div className="space-y-2 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <Repeat2 className="size-4" />
              Повтор
            </span>
            <div className="w-[160px] shrink-0">
              <Select
                label="Повтор"
                options={REPEAT_SELECT_OPTIONS}
                value={draftScheduleKind}
                valueLabel={getRepeatLabel(draftScheduleKind, draftScheduleInterval, draftScheduleUnit)}
                onChange={setDraftScheduleKind}
                multiple={false}
              />
            </div>
          </div>

          {draftScheduleKind === "custom" && (
            <div className="grid grid-cols-[minmax(0,1fr)_142px] gap-2">
              <Input
                min={1}
                type="number"
                value={draftScheduleInterval}
                onChange={(event) => setDraftScheduleInterval(Number(event.target.value) || 1)}
                className="h-9"
              />
              <Select
                label="Период"
                options={SCHEDULE_UNIT_OPTIONS}
                value={draftScheduleUnit}
                onChange={setDraftScheduleUnit}
                multiple={false}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const settingsFooter = (
    <div className="grid grid-cols-2 gap-2 border-t bg-background p-4">
      <Button type="button" variant="outline" className="h-auto px-0 py-0 leading-none" onClick={handleCancel}>
        Отмена
      </Button>
      <Button type="button" onClick={handleApply}>
        OK
      </Button>
    </div>
  );

  const settingsContent = (
    <>
      {settingsBody}
      {settingsFooter}
    </>
  );

  if (isMobile) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          className="h-auto w-full justify-between px-3 py-2 text-left font-normal"
          aria-expanded={open}
          data-state={open ? "open" : "closed"}
          onClick={() => setOpen(true)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarClock className="size-4 text-muted-foreground" />
            <span className="truncate">{triggerLabel}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogWindow mobilePosition="bottom" className="h-dvh gap-0 overflow-hidden rounded-none p-0">
            <DialogHeader className="py-4">
              <DialogTitle>Дата и уведомления</DialogTitle>
            </DialogHeader>
            <DialogContent className="min-h-0 px-0 pb-0">{settingsBody}</DialogContent>
            {settingsFooter}
          </DialogWindow>
        </Dialog>
      </>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      className="max-h-[var(--popover-content-available-height)] w-[286px] overflow-y-auto rounded-2xl p-0"
      trigger={({ ref, ...triggerProps }) => (
        <Button
          ref={ref}
          type="button"
          variant="outline"
          className="h-auto w-full justify-between px-3 py-2 text-left font-normal"
          {...triggerProps}
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarClock className="size-4 text-muted-foreground" />
            <span className="truncate">{triggerLabel}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      )}
    >
      {settingsContent}
    </Popover>
  );
}

export function ScheduledPaymentForm({
  accounts,
  baseCurrency = "BYN",
  categories,
  initialPayment,
  members,
  onCloseComplete,
  onOpenChange,
  onSubmit,
  open,
  workspaceId,
}: ScheduledPaymentFormProps) {
  const { data: session } = useSession();
  const tomorrow = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    return date;
  }, []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currency, setCurrency] = useState<Currency>(() => toCurrency(baseCurrency));
  const [nextDueAt, setNextDueAt] = useState<Date>(tomorrow);
  const [scheduleKind, setScheduleKind] = useState<ScheduledPaymentFormInput["scheduleKind"]>("one_time");
  const [scheduleInterval, setScheduleInterval] = useState(1);
  const [scheduleUnit, setScheduleUnit] = useState<NonNullable<ScheduledPaymentFormInput["scheduleUnit"]>>("months");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [reminders, setReminders] = useState(DEFAULT_REMINDER_DAYS);
  const [notifyTelegram, setNotifyTelegram] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const isEditing = Boolean(initialPayment);
  const currentMemberId = useMemo(() => {
    if (!session?.user.id) return "";
    return members.find((member) => member.id === session.user.id)?.id ?? "";
  }, [members, session?.user.id]);
  const defaultAccount = useMemo(() => {
    if (!session?.user.id) return undefined;
    return accounts.find((account) => account.ownerId === session.user.id);
  }, [accounts, session?.user.id]);

  useEffect(() => {
    if (!open) return;

    setCurrency(toCurrency(initialPayment?.currency ?? baseCurrency));
    setNextDueAt(initialPayment?.nextDueAt ?? tomorrow);
    setScheduleKind((initialPayment?.scheduleKind as ScheduledPaymentFormInput["scheduleKind"]) ?? "one_time");
    setScheduleInterval(initialPayment?.scheduleInterval ?? 1);
    setScheduleUnit(
      (initialPayment?.scheduleUnit as NonNullable<ScheduledPaymentFormInput["scheduleUnit"]> | null) ?? "months"
    );
    setAccountId(initialPayment ? (initialPayment.accountId ?? "") : (defaultAccount?.id ?? ""));
    setCategoryId(initialPayment?.categoryId ?? "");
    setAssignedUserId(initialPayment?.assignedUserId ?? currentMemberId);
    setReminders(initialPayment?.reminderDaysBefore ?? DEFAULT_REMINDER_DAYS);
    setNotifyTelegram(initialPayment?.notifyTelegram ?? true);
    setNotifyEmail(initialPayment?.notifyEmail ?? false);
  }, [baseCurrency, currentMemberId, defaultAccount?.id, initialPayment, open, tomorrow]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId) ?? null,
    [accountId, accounts]
  );

  const categoryOptions = useMemo<SelectOption<string>[]>(
    () => [
      { value: "", label: "Не выбрана" },
      ...categories.map((category) => ({ value: category.id, label: category.name })),
    ],
    [categories]
  );

  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const selectedMember = assignedUserId ? memberById.get(assignedUserId) : null;
  const notificationChannels = selectedMember?.notificationChannels ?? { email: true, telegram: true };
  const orderedMembers = useMemo(() => {
    if (!currentMemberId) return members;
    return [...members].sort((first, second) => {
      if (first.id === currentMemberId) return -1;
      if (second.id === currentMemberId) return 1;
      return 0;
    });
  }, [currentMemberId, members]);
  const memberOptions = useMemo<SelectOption<string>[]>(
    () =>
      orderedMembers.map((member) => ({
        value: member.id,
        label: member.name || member.email || "Участник",
      })),
    [orderedMembers]
  );

  useEffect(() => {
    if (!notificationChannels.email) {
      setNotifyEmail(false);
    }
    if (!notificationChannels.telegram) {
      setNotifyTelegram(false);
    }
  }, [notificationChannels.email, notificationChannels.telegram]);

  function renderMemberOption({ option, selected, isTrigger }: RenderOptionProps<string>) {
    const member = memberById.get(option.value);

    return (
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <UserAvatar
            name={member?.name ?? option.label}
            email={member?.email}
            image={member?.image}
            size={isTrigger ? "sm" : "md"}
            fallbackClassName="font-normal"
          />
          <span className="min-w-0 truncate text-sm font-normal text-foreground">{member?.name ?? option.label}</span>
        </div>
        {!isTrigger && selected && <span className="size-2 rounded-full bg-primary" />}
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsSubmitting(true);
    try {
      await onSubmit({
        accountId: accountId || null,
        amount: String(form.get("amount") || "") || undefined,
        amountMax: String(form.get("amountMax") || "") || undefined,
        amountMin: String(form.get("amountMin") || "") || undefined,
        amountMode: "fixed",
        assignedUserId: assignedUserId || null,
        categoryId: categoryId || null,
        currency,
        dueDay: scheduleKind === "monthly" ? nextDueAt.getDate() : null,
        dueMonth: scheduleKind === "yearly" ? nextDueAt.getMonth() + 1 : null,
        name: String(form.get("name") || ""),
        nextDueAt,
        notifyEmail: notificationChannels.email && notifyEmail,
        notifyTelegram: notificationChannels.telegram && notifyTelegram,
        reminderDaysBefore: reminders,
        scheduleInterval,
        scheduleKind,
        scheduleUnit: scheduleKind === "custom" ? scheduleUnit : null,
        timezone: "Europe/Minsk",
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogWindow
        className="h-dvh gap-0 rounded-none pt-6 pb-0 md:h-auto md:w-[680px] gap-6 md:rounded-lg"
        mobilePosition="bottom"
        onCloseComplete={onCloseComplete}
      >
        <DialogHeader>
          <DialogTitle>{isEditing ? "Редактировать платёж" : "Новый платёж"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-0 md:pb-4">
            <div className={FIELD_CLASS}>
              <Label htmlFor="scheduled-name" required>
                Название
              </Label>
              <Input
                id="scheduled-name"
                name="name"
                required
                placeholder="A1 mobile"
                defaultValue={initialPayment?.name}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className={FIELD_CLASS}>
                <Label htmlFor="amount" required>
                  Сумма
                </Label>
                <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2">
                  <NumberInput
                    id="amount"
                    name="amount"
                    placeholder="0.00"
                    required
                    defaultValue={initialPayment?.amount ?? ""}
                  />
                  <Select
                    options={CURRENCY_OPTIONS}
                    value={currency}
                    valueLabel={currency}
                    onChange={(value) => setCurrency(value)}
                    multiple={false}
                  />
                </div>
              </div>
              <div className={FIELD_CLASS}>
                <Label>Ответственный</Label>
                <Select
                  options={memberOptions}
                  value={assignedUserId}
                  onChange={(value) => setAssignedUserId(value)}
                  renderOption={renderMemberOption}
                  multiple={false}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Счёт</Label>
                  {accountId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto px-0 py-0 leading-none"
                      onClick={() => setAccountId("")}
                    >
                      Очистить
                    </Button>
                  )}
                </div>
                <AccountSelector
                  workspaceId={workspaceId}
                  account={selectedAccount}
                  onSelect={(account) => setAccountId(account.id)}
                />
              </div>
              <div className={FIELD_CLASS}>
                <Label>Категория</Label>
                <Select
                  options={categoryOptions}
                  value={categoryId}
                  onChange={(value) => setCategoryId(value)}
                  multiple={false}
                />
              </div>
              <div className={cn(FIELD_CLASS, "md:col-span-2")}>
                <Label required>Дата, уведомления, повтор</Label>
                <ScheduleSettingsDropdown
                  notificationChannels={notificationChannels}
                  nextDueAt={nextDueAt}
                  notifyEmail={notifyEmail}
                  notifyTelegram={notifyTelegram}
                  reminderDaysBefore={reminders}
                  scheduleInterval={scheduleInterval}
                  scheduleKind={scheduleKind}
                  scheduleUnit={scheduleUnit}
                  onNextDueAtChange={setNextDueAt}
                  onNotifyEmailChange={setNotifyEmail}
                  onNotifyTelegramChange={setNotifyTelegram}
                  onReminderDaysBeforeChange={setReminders}
                  onScheduleIntervalChange={setScheduleInterval}
                  onScheduleKindChange={setScheduleKind}
                  onScheduleUnitChange={setScheduleUnit}
                />
                <p className="truncate text-xs text-muted-foreground">
                  {getRemindersLabel(reminders)} · {notifyEmail ? "Email" : "Email выкл."}
                  {notifyTelegram ? " · Telegram" : ""}
                </p>
              </div>
            </div>
          </DialogContent>
          <DialogFooter className="shrink-0 border-t bg-background py-4">
            <Button
              type="button"
              variant="outline"
              className="hidden md:inline-flex"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button disabled={isSubmitting} type="submit" className="w-full md:w-auto">
              {isEditing ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogWindow>
    </Dialog>
  );
}
