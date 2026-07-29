-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";
BEGIN;

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'EUR', 'RUB', 'BYN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "image" TEXT,
    "avatarStorageKey" TEXT,
    "password" TEXT,
    "emailVerified" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "photoUrl" TEXT,
    "linkedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_email_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'BYN',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "balance" TEXT NOT NULL DEFAULT '0',
    "initialBalance" TEXT NOT NULL DEFAULT '0',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hidden_accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hidden_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "iconAssetId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_icon_assets" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "isDeleting" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "category_icon_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoryId" TEXT,
    "createdByAi" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "createdById" TEXT,
    "amount" TEXT NOT NULL,
    "toAmount" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByAi" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_invites" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_registrations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMPTZ(3) NOT NULL,
    "fromCurrency" "Currency" NOT NULL,
    "toCurrency" "Currency" NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "remainingAmount" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "date" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "debts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_transactions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "accountId" TEXT,
    "paymentTransactionId" TEXT,
    "type" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "toAmount" TEXT,
    "date" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bot_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramChatId" TEXT,
    "activeWorkspaceId" TEXT,
    "defaultAccountByWorkspace" JSONB,
    "receiptMode" TEXT NOT NULL DEFAULT 'category',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Minsk',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "telegram_bot_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_finance_drafts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramChatId" TEXT,
    "workspaceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sourceType" TEXT NOT NULL,
    "sourceText" TEXT,
    "receiptMode" TEXT,
    "kind" TEXT,
    "payload" JSONB NOT NULL,
    "missingFields" TEXT[],
    "confidence" DOUBLE PRECISION,
    "currentQuestion" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "committedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ai_finance_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_payments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountMode" TEXT NOT NULL,
    "amount" TEXT,
    "amountMin" TEXT,
    "amountMax" TEXT,
    "currency" TEXT,
    "categoryId" TEXT,
    "accountId" TEXT,
    "assignedUserId" TEXT,
    "createdById" TEXT NOT NULL,
    "scheduleKind" TEXT NOT NULL,
    "scheduleInterval" INTEGER NOT NULL DEFAULT 1,
    "scheduleUnit" TEXT,
    "dueDay" INTEGER,
    "dueMonth" INTEGER,
    "nextDueAt" TIMESTAMPTZ(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Minsk',
    "reminderDaysBefore" INTEGER[],
    "notifyTelegram" BOOLEAN NOT NULL DEFAULT false,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "lastPaidAt" TIMESTAMPTZ(3),
    "snoozedUntil" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "scheduled_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_payment_records" (
    "id" TEXT NOT NULL,
    "scheduledPaymentId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "transactionId" TEXT,
    "dueAt" TIMESTAMPTZ(3) NOT NULL,
    "paidAt" TIMESTAMPTZ(3),
    "skippedAt" TIMESTAMPTZ(3),
    "amount" TEXT,
    "currency" TEXT,
    "accountId" TEXT,
    "categoryId" TEXT,
    "actionById" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_payment_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_payment_reminder_deliveries" (
    "id" TEXT NOT NULL,
    "scheduledPaymentId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dueAt" TIMESTAMPTZ(3) NOT NULL,
    "reminderDate" TIMESTAMPTZ(3) NOT NULL,
    "daysBefore" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sentAt" TIMESTAMPTZ(3),
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_payment_reminder_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "auth_identities_userId_idx" ON "auth_identities"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_provider_providerUserId_key" ON "auth_identities"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "pending_email_verifications_token_key" ON "pending_email_verifications"("token");

-- CreateIndex
CREATE INDEX "pending_email_verifications_email_idx" ON "pending_email_verifications"("email");

-- CreateIndex
CREATE INDEX "pending_email_verifications_expiresAt_idx" ON "pending_email_verifications"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "pending_email_verifications_userId_key" ON "pending_email_verifications"("userId");

-- CreateIndex
CREATE INDEX "password_reset_codes_email_idx" ON "password_reset_codes"("email");

-- CreateIndex
CREATE INDEX "password_reset_codes_expiresAt_idx" ON "password_reset_codes"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_codes_userId_key" ON "password_reset_codes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_tokenHash_key" ON "auth_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions"("userId");

-- CreateIndex
CREATE INDEX "auth_sessions_expiresAt_idx" ON "auth_sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspaces_ownerId_idx" ON "workspaces"("ownerId");

-- CreateIndex
CREATE INDEX "workspace_members_userId_idx" ON "workspace_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspaceId_userId_key" ON "workspace_members"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "accounts_workspaceId_archived_idx" ON "accounts"("workspaceId", "archived");

-- CreateIndex
CREATE INDEX "accounts_workspaceId_ownerId_archived_order_idx" ON "accounts"("workspaceId", "ownerId", "archived", "order");

-- CreateIndex
CREATE INDEX "accounts_ownerId_idx" ON "accounts"("ownerId");

-- CreateIndex
CREATE INDEX "hidden_accounts_userId_accountId_idx" ON "hidden_accounts"("userId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "hidden_accounts_accountId_userId_key" ON "hidden_accounts"("accountId", "userId");

-- CreateIndex
CREATE INDEX "categories_workspaceId_type_order_idx" ON "categories"("workspaceId", "type", "order");

-- CreateIndex
CREATE INDEX "categories_iconAssetId_idx" ON "categories"("iconAssetId");

-- CreateIndex
CREATE INDEX "category_icon_assets_workspaceId_createdAt_idx" ON "category_icon_assets"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "category_icon_assets_uploadedById_idx" ON "category_icon_assets"("uploadedById");

-- CreateIndex
CREATE INDEX "transactions_workspaceId_date_idx" ON "transactions"("workspaceId", "date");

-- CreateIndex
CREATE INDEX "transactions_workspaceId_type_date_idx" ON "transactions"("workspaceId", "type", "date");

-- CreateIndex
CREATE INDEX "transactions_workspaceId_categoryId_date_idx" ON "transactions"("workspaceId", "categoryId", "date");

-- CreateIndex
CREATE INDEX "transactions_workspaceId_accountId_date_idx" ON "transactions"("workspaceId", "accountId", "date");

-- CreateIndex
CREATE INDEX "transactions_accountId_date_idx" ON "transactions"("accountId", "date");

-- CreateIndex
CREATE INDEX "transactions_categoryId_idx" ON "transactions"("categoryId");

-- CreateIndex
CREATE INDEX "transfers_workspaceId_date_idx" ON "transfers"("workspaceId", "date");

-- CreateIndex
CREATE INDEX "transfers_workspaceId_createdById_date_idx" ON "transfers"("workspaceId", "createdById", "date");

-- CreateIndex
CREATE INDEX "transfers_workspaceId_fromAccountId_date_idx" ON "transfers"("workspaceId", "fromAccountId", "date");

-- CreateIndex
CREATE INDEX "transfers_workspaceId_toAccountId_date_idx" ON "transfers"("workspaceId", "toAccountId", "date");

-- CreateIndex
CREATE INDEX "transfers_fromAccountId_date_idx" ON "transfers"("fromAccountId", "date");

-- CreateIndex
CREATE INDEX "transfers_toAccountId_date_idx" ON "transfers"("toAccountId", "date");

-- CreateIndex
CREATE INDEX "transfers_createdById_idx" ON "transfers"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_invites_token_key" ON "workspace_invites"("token");

-- CreateIndex
CREATE INDEX "workspace_invites_workspaceId_email_idx" ON "workspace_invites"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "workspace_invites_expiresAt_idx" ON "workspace_invites"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "pending_registrations_email_key" ON "pending_registrations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pending_registrations_token_key" ON "pending_registrations"("token");

-- CreateIndex
CREATE INDEX "pending_registrations_expiresAt_idx" ON "pending_registrations"("expiresAt");

-- CreateIndex
CREATE INDEX "exchange_rates_date_idx" ON "exchange_rates"("date");

-- CreateIndex
CREATE INDEX "exchange_rates_fromCurrency_toCurrency_idx" ON "exchange_rates"("fromCurrency", "toCurrency");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_date_fromCurrency_toCurrency_key" ON "exchange_rates"("date", "fromCurrency", "toCurrency");

-- CreateIndex
CREATE INDEX "debts_workspaceId_status_idx" ON "debts"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "debts_workspaceId_status_date_idx" ON "debts"("workspaceId", "status", "date");

-- CreateIndex
CREATE INDEX "debts_workspaceId_type_status_date_idx" ON "debts"("workspaceId", "type", "status", "date");

-- CreateIndex
CREATE INDEX "debt_transactions_workspaceId_date_idx" ON "debt_transactions"("workspaceId", "date");

-- CreateIndex
CREATE INDEX "debt_transactions_workspaceId_accountId_date_idx" ON "debt_transactions"("workspaceId", "accountId", "date");

-- CreateIndex
CREATE INDEX "debt_transactions_workspaceId_type_date_idx" ON "debt_transactions"("workspaceId", "type", "date");

-- CreateIndex
CREATE INDEX "debt_transactions_debtId_idx" ON "debt_transactions"("debtId");

-- CreateIndex
CREATE INDEX "debt_transactions_accountId_idx" ON "debt_transactions"("accountId");

-- CreateIndex
CREATE INDEX "debt_transactions_paymentTransactionId_idx" ON "debt_transactions"("paymentTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bot_preferences_userId_key" ON "telegram_bot_preferences"("userId");

-- CreateIndex
CREATE INDEX "telegram_bot_preferences_activeWorkspaceId_idx" ON "telegram_bot_preferences"("activeWorkspaceId");

-- CreateIndex
CREATE INDEX "ai_finance_drafts_userId_status_updatedAt_idx" ON "ai_finance_drafts"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "ai_finance_drafts_telegramChatId_status_updatedAt_idx" ON "ai_finance_drafts"("telegramChatId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "ai_finance_drafts_workspaceId_idx" ON "ai_finance_drafts"("workspaceId");

-- CreateIndex
CREATE INDEX "ai_finance_drafts_expiresAt_idx" ON "ai_finance_drafts"("expiresAt");

-- CreateIndex
CREATE INDEX "scheduled_payments_workspaceId_nextDueAt_idx" ON "scheduled_payments"("workspaceId", "nextDueAt");

-- CreateIndex
CREATE INDEX "scheduled_payments_assignedUserId_nextDueAt_idx" ON "scheduled_payments"("assignedUserId", "nextDueAt");

-- CreateIndex
CREATE INDEX "scheduled_payments_nextDueAt_idx" ON "scheduled_payments"("nextDueAt");

-- CreateIndex
CREATE INDEX "scheduled_payments_accountId_idx" ON "scheduled_payments"("accountId");

-- CreateIndex
CREATE INDEX "scheduled_payments_categoryId_idx" ON "scheduled_payments"("categoryId");

-- CreateIndex
CREATE INDEX "scheduled_payments_createdById_idx" ON "scheduled_payments"("createdById");

-- CreateIndex
CREATE INDEX "scheduled_payment_records_scheduledPaymentId_dueAt_idx" ON "scheduled_payment_records"("scheduledPaymentId", "dueAt");

-- CreateIndex
CREATE INDEX "scheduled_payment_records_workspaceId_createdAt_idx" ON "scheduled_payment_records"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "scheduled_payment_records_transactionId_idx" ON "scheduled_payment_records"("transactionId");

-- CreateIndex
CREATE INDEX "scheduled_payment_records_accountId_idx" ON "scheduled_payment_records"("accountId");

-- CreateIndex
CREATE INDEX "scheduled_payment_records_categoryId_idx" ON "scheduled_payment_records"("categoryId");

-- CreateIndex
CREATE INDEX "scheduled_payment_records_actionById_idx" ON "scheduled_payment_records"("actionById");

-- CreateIndex
CREATE INDEX "scheduled_payment_reminder_deliveries_workspaceId_reminderD_idx" ON "scheduled_payment_reminder_deliveries"("workspaceId", "reminderDate");

-- CreateIndex
CREATE INDEX "scheduled_payment_reminder_deliveries_userId_reminderDate_idx" ON "scheduled_payment_reminder_deliveries"("userId", "reminderDate");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_payment_reminder_deliveries_scheduledPaymentId_du_key" ON "scheduled_payment_reminder_deliveries"("scheduledPaymentId", "dueAt", "daysBefore", "channel");

-- AddForeignKey
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_email_verifications" ADD CONSTRAINT "pending_email_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_codes" ADD CONSTRAINT "password_reset_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hidden_accounts" ADD CONSTRAINT "hidden_accounts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hidden_accounts" ADD CONSTRAINT "hidden_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_iconAssetId_fkey" FOREIGN KEY ("iconAssetId") REFERENCES "category_icon_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_icon_assets" ADD CONSTRAINT "category_icon_assets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_icon_assets" ADD CONSTRAINT "category_icon_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_transactions" ADD CONSTRAINT "debt_transactions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_transactions" ADD CONSTRAINT "debt_transactions_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "debts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_transactions" ADD CONSTRAINT "debt_transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_transactions" ADD CONSTRAINT "debt_transactions_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_preferences" ADD CONSTRAINT "telegram_bot_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_preferences" ADD CONSTRAINT "telegram_bot_preferences_activeWorkspaceId_fkey" FOREIGN KEY ("activeWorkspaceId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_finance_drafts" ADD CONSTRAINT "ai_finance_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_finance_drafts" ADD CONSTRAINT "ai_finance_drafts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_payments" ADD CONSTRAINT "scheduled_payments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_payments" ADD CONSTRAINT "scheduled_payments_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_payments" ADD CONSTRAINT "scheduled_payments_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_payments" ADD CONSTRAINT "scheduled_payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_payments" ADD CONSTRAINT "scheduled_payments_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_payment_records" ADD CONSTRAINT "scheduled_payment_records_scheduledPaymentId_fkey" FOREIGN KEY ("scheduledPaymentId") REFERENCES "scheduled_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_payment_records" ADD CONSTRAINT "scheduled_payment_records_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_payment_records" ADD CONSTRAINT "scheduled_payment_records_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_payment_records" ADD CONSTRAINT "scheduled_payment_records_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_payment_records" ADD CONSTRAINT "scheduled_payment_records_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_payment_records" ADD CONSTRAINT "scheduled_payment_records_actionById_fkey" FOREIGN KEY ("actionById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_payment_reminder_deliveries" ADD CONSTRAINT "scheduled_payment_reminder_deliveries_scheduledPaymentId_fkey" FOREIGN KEY ("scheduledPaymentId") REFERENCES "scheduled_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_payment_reminder_deliveries" ADD CONSTRAINT "scheduled_payment_reminder_deliveries_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_payment_reminder_deliveries" ADD CONSTRAINT "scheduled_payment_reminder_deliveries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
