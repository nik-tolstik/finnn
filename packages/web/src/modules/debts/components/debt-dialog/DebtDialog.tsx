import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/shared/ui/button";
import { Dialog, type DialogAction, DialogContent, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
import { Segmented } from "@/shared/ui/segmented";
import { formatMoney } from "@/shared/utils/money";

import { DebtType } from "../../debt.constants";
import type { DebtWithRelations } from "../../debt.types";
import { AddToDebtPanel } from "../add-to-debt-dialog/AddToDebtDialog";
import { CloseDebtPanel } from "../close-debt-dialog/CloseDebtDialog";
import { DebtWriteOffPanel } from "../debt-write-off-dialog/DebtWriteOffDialog";
import { DeleteDebtPanel } from "../delete-debt-dialog/DeleteDebtDialog";
import { EditDebtPanel } from "../edit-debt-dialog/EditDebtDialog";
import {
  DEBT_DIALOG_DEFAULT_OPERATION,
  type DebtDialogOperation,
  getDebtDialogCapabilities,
  getDebtDialogOperationOptions,
} from "./debt-dialog.utils";

type DebtDialogView = "operations" | "edit" | "delete";

interface DebtDialogProps {
  debt: DebtWithRelations;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
}

interface DebtDialogOperationsProps {
  debt: DebtWithRelations;
  isOperationsView: boolean;
  isSubmitting: boolean;
  onComplete: () => void;
  onOperationChange: (operation: DebtDialogOperation) => void;
  onSubmittingChange: (isSubmitting: boolean) => void;
  operation: DebtDialogOperation;
  operationOptions: ReturnType<typeof getDebtDialogOperationOptions>;
  open: boolean;
  visitedOperations: Set<DebtDialogOperation>;
  workspaceId: string;
}

function DebtReadOnlySummary({ debt }: { debt: DebtWithRelations }) {
  const directionLabel = debt.type === DebtType.LENT ? "Мне должны" : "Я должен";

  return (
    <DialogContent>
      <div className="space-y-4 rounded-xl bg-muted/60 p-4">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">{directionLabel}</div>
          <div className="text-lg font-semibold">{debt.personName}</div>
        </div>
        <div className="flex items-end justify-between gap-4">
          <div className="text-sm text-muted-foreground">Закрытый долг</div>
          <div className="text-right text-lg font-semibold">{formatMoney(debt.amount, debt.currency)}</div>
        </div>
      </div>
    </DialogContent>
  );
}

function DebtDialogOperations({
  debt,
  isOperationsView,
  isSubmitting,
  onComplete,
  onOperationChange,
  onSubmittingChange,
  operation,
  operationOptions,
  open,
  visitedOperations,
  workspaceId,
}: DebtDialogOperationsProps) {
  return (
    <>
      <div className="contents" hidden={!isOperationsView}>
        <DialogContent className="flex-none shrink-0 pb-0">
          <Segmented
            className="w-full"
            disabled={isSubmitting}
            layout="fill"
            onChange={onOperationChange}
            options={operationOptions}
            value={operation}
          />
        </DialogContent>
      </div>

      {visitedOperations.has("close") ? (
        <div className="contents" hidden={!isOperationsView || operation !== "close"}>
          <CloseDebtPanel
            debt={debt}
            workspaceId={workspaceId}
            open={open}
            onComplete={onComplete}
            onSubmittingChange={onSubmittingChange}
          />
        </div>
      ) : null}

      {visitedOperations.has("add") ? (
        <div className="contents" hidden={!isOperationsView || operation !== "add"}>
          <AddToDebtPanel
            debt={debt}
            workspaceId={workspaceId}
            open={open}
            onComplete={onComplete}
            onSubmittingChange={onSubmittingChange}
          />
        </div>
      ) : null}

      {visitedOperations.has("transaction") ? (
        <div className="contents" hidden={!isOperationsView || operation !== "transaction"}>
          <DebtWriteOffPanel
            debt={debt}
            workspaceId={workspaceId}
            open={open}
            onComplete={onComplete}
            onSubmittingChange={onSubmittingChange}
          />
        </div>
      ) : null}
    </>
  );
}

export function DebtDialog({ debt, workspaceId, open, onOpenChange, onCloseComplete }: DebtDialogProps) {
  const capabilities = getDebtDialogCapabilities(debt);
  const operationOptions = getDebtDialogOperationOptions(debt);
  const [view, setView] = useState<DebtDialogView>("operations");
  const [operation, setOperation] = useState<DebtDialogOperation>(DEBT_DIALOG_DEFAULT_OPERATION);
  const [visitedOperations, setVisitedOperations] = useState<Set<DebtDialogOperation>>(
    () => new Set([DEBT_DIALOG_DEFAULT_OPERATION])
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const openedDebtIdRef = useRef<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleFocusKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      openedDebtIdRef.current = null;
      return;
    }

    if (openedDebtIdRef.current === debt.id) {
      return;
    }

    openedDebtIdRef.current = debt.id;
    setView("operations");
    setOperation(DEBT_DIALOG_DEFAULT_OPERATION);
    setVisitedOperations(new Set([DEBT_DIALOG_DEFAULT_OPERATION]));
    setIsSubmitting(false);
  }, [debt.id, open]);

  useEffect(() => {
    const focusKey = open ? `${debt.id}:${view}` : null;
    if (focusKey === titleFocusKeyRef.current) {
      return;
    }

    titleFocusKeyRef.current = focusKey;
    if (!focusKey) {
      return;
    }

    const frameId = requestAnimationFrame(() => titleRef.current?.focus());

    return () => cancelAnimationFrame(frameId);
  }, [debt.id, open, view]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isSubmitting) {
      return;
    }

    onOpenChange(nextOpen);
  };

  const handleOperationChange = (nextOperation: DebtDialogOperation) => {
    if (isSubmitting) {
      return;
    }

    setOperation(nextOperation);
    setVisitedOperations((current) => new Set(current).add(nextOperation));
  };

  const handleComplete = () => onOpenChange(false);
  const title =
    view === "edit" ? "Редактировать долг" : view === "delete" ? "Удалить долг?" : `Долг: ${debt.personName}`;
  const actions: DialogAction[] = [];

  if (view === "operations" && capabilities.canEdit) {
    actions.push({
      id: "edit",
      icon: <Pencil />,
      label: "Редактировать долг",
      onSelect: () => setView("edit"),
      disabled: isSubmitting,
    });
  }

  if (view === "operations" && capabilities.canDelete) {
    actions.push({
      id: "delete",
      icon: <Trash2 />,
      label: "Удалить долг",
      onSelect: () => setView("delete"),
      tone: "destructive",
      disabled: isSubmitting,
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogWindow
        className="sm:w-[500px]"
        closeButtonDisabled={isSubmitting}
        actions={actions}
        onCloseComplete={onCloseComplete}
      >
        <DialogHeader>
          <div className="flex min-w-0 items-center gap-1">
            {view !== "operations" ? (
              <Button
                aria-label="Назад к действиям долга"
                disabled={isSubmitting}
                onClick={() => setView("operations")}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <ArrowLeft />
              </Button>
            ) : null}
            <DialogTitle ref={titleRef} className="truncate focus:outline-none" tabIndex={-1}>
              {title}
            </DialogTitle>
          </div>
        </DialogHeader>

        {view === "edit" && capabilities.canEdit ? (
          <EditDebtPanel
            debt={debt}
            workspaceId={workspaceId}
            open={open}
            onComplete={handleComplete}
            onSubmittingChange={setIsSubmitting}
          />
        ) : null}

        {view === "delete" ? (
          <DeleteDebtPanel
            debt={debt}
            workspaceId={workspaceId}
            onComplete={handleComplete}
            onSubmittingChange={setIsSubmitting}
          />
        ) : null}

        {view === "operations" && !capabilities.hasOperations ? <DebtReadOnlySummary debt={debt} /> : null}

        {capabilities.hasOperations ? (
          <DebtDialogOperations
            debt={debt}
            isOperationsView={view === "operations"}
            isSubmitting={isSubmitting}
            onComplete={handleComplete}
            onOperationChange={handleOperationChange}
            onSubmittingChange={setIsSubmitting}
            operation={operation}
            operationOptions={operationOptions}
            open={open}
            visitedOperations={visitedOperations}
            workspaceId={workspaceId}
          />
        ) : null}
      </DialogWindow>
    </Dialog>
  );
}

export type { DebtDialogOperation };
export { DEBT_DIALOG_DEFAULT_OPERATION, getDebtDialogCapabilities, getDebtDialogOperationOptions };
