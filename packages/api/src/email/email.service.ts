import { Injectable } from "@nestjs/common";
import nodemailer from "nodemailer";

type EmailResult = { success: true } | { error: string };
type ScheduledPaymentReminderEmailInput = {
  email: string;
  paymentName: string;
  workspaceName: string;
  dueAt: Date;
  amountLabel: string;
  scheduledPaymentId: string;
};

function getWebBaseUrl(): string {
  const configuredUrl = process.env.WEB_APP_URL?.trim();
  if (configuredUrl) return configuredUrl;

  const firstAllowedOrigin = process.env.API_ALLOWED_ORIGINS?.split(",")[0]?.trim();
  if (firstAllowedOrigin) return firstAllowedOrigin;

  return "http://localhost:3000";
}

@Injectable()
export class EmailService {
  private createTransporter() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number.parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async sendVerificationEmail(email: string, token: string, name?: string | null): Promise<EmailResult> {
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        return { error: "Email сервис не настроен. Обратитесь к администратору." };
      }

      const transporter = this.createTransporter();

      const verifyUrl = `${getWebBaseUrl()}/verify-email/${token}`;

      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: "Подтвердите ваш email",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Подтверждение email</h2>
            <p>${name ? `Здравствуйте, ${name}!` : "Здравствуйте!"}</p>
            <p>Спасибо за регистрацию в Finnn. Для завершения регистрации подтвердите ваш email адрес.</p>
            <p>Для подтверждения перейдите по ссылке:</p>
            <p style="margin: 20px 0;">
              <a href="${verifyUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Подтвердить email
              </a>
            </p>
            <p style="color: #666; font-size: 12px;">
              Или скопируйте эту ссылку в браузер: ${verifyUrl}
            </p>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">
              Если вы не регистрировались в Finnn, просто проигнорируйте это письмо.
            </p>
          </div>
        `,
      });

      return { success: true };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Не удалось отправить email" };
    }
  }

  async sendInviteEmail(email: string, token: string, workspaceName: string): Promise<EmailResult> {
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        return { error: "Email сервис не настроен. Обратитесь к администратору." };
      }

      const transporter = this.createTransporter();
      const inviteUrl = `${getWebBaseUrl()}/invite/${token}`;

      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: `Приглашение в рабочий стол "${workspaceName}"`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Приглашение в рабочий стол</h2>
            <p>Вы были приглашены присоединиться к рабочему столу <strong>${workspaceName}</strong>.</p>
            <p>Для принятия приглашения перейдите по ссылке:</p>
            <p style="margin: 20px 0;">
              <a href="${inviteUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Принять приглашение
              </a>
            </p>
            <p style="color: #666; font-size: 12px;">
              Или скопируйте эту ссылку в браузер: ${inviteUrl}
            </p>
          </div>
        `,
      });

      return { success: true };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Не удалось отправить email" };
    }
  }

  async sendPasswordResetCode(email: string, code: string, name?: string | null): Promise<EmailResult> {
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        return { error: "Email сервис не настроен. Обратитесь к администратору." };
      }

      const transporter = this.createTransporter();

      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: "Код восстановления пароля Finnn",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Восстановление пароля</h2>
            <p>${name ? `Здравствуйте, ${name}!` : "Здравствуйте!"}</p>
            <p>Введите этот код на странице восстановления пароля Finnn:</p>
            <p style="font-size: 28px; letter-spacing: 6px; font-weight: 700; margin: 24px 0;">${code}</p>
            <p style="color: #666; font-size: 12px;">
              Код действует ограниченное время. Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо.
            </p>
          </div>
        `,
      });

      return { success: true };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Не удалось отправить email" };
    }
  }

  async sendScheduledPaymentReminderEmail(input: ScheduledPaymentReminderEmailInput): Promise<EmailResult> {
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        return { error: "Email сервис не настроен. Обратитесь к администратору." };
      }

      const transporter = this.createTransporter();
      const paymentUrl = `${getWebBaseUrl()}/payments/${input.scheduledPaymentId}`;
      const dueDate = input.dueAt.toLocaleDateString("ru-RU");

      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: input.email,
        subject: `Напоминание о платеже: ${input.paymentName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Напоминание о платеже</h2>
            <p>Платёж <strong>${input.paymentName}</strong> в рабочем столе <strong>${input.workspaceName}</strong> скоро нужно оплатить.</p>
            <p><strong>Срок:</strong> ${dueDate}</p>
            <p><strong>Сумма:</strong> ${input.amountLabel}</p>
            <p style="margin: 20px 0;">
              <a href="${paymentUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Открыть платёж
              </a>
            </p>
            <p style="color: #666; font-size: 12px;">
              Если вы не создавали этот платёж, проверьте участников рабочего стола в Finnn.
            </p>
          </div>
        `,
      });

      return { success: true };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Не удалось отправить email" };
    }
  }
}
