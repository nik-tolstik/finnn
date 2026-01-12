"use server";

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  throw new Error("APP_URL не установлен. Установите NEXT_PUBLIC_APP_URL или NEXTAUTH_URL в .env");
}

export async function sendInviteEmail(email: string, token: string, workspaceName: string) {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.error("SMTP настройки не установлены. Проверьте SMTP_USER и SMTP_PASSWORD в .env");
      return { error: "Email сервис не настроен. Обратитесь к администратору." };
    }

    const baseUrl = getBaseUrl();
    const inviteUrl = `${baseUrl}/invite/${token}`;

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

    console.warn("Email успешно отправлен на:", email);
    return { success: true };
  } catch (error: any) {
    console.error("Ошибка отправки email:", error);
    return { error: error.message || "Не удалось отправить email" };
  }
}

export async function sendVerificationEmail(email: string, token: string, name?: string | null) {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.error("SMTP настройки не установлены. Проверьте SMTP_USER и SMTP_PASSWORD в .env");
      return { error: "Email сервис не настроен. Обратитесь к администратору." };
    }

    const baseUrl = getBaseUrl();
    const verifyUrl = `${baseUrl}/verify-email/${token}`;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Подтвердите ваш email",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Подтверждение email</h2>
          <p>${name ? `Здравствуйте, ${name}!` : "Здравствуйте!"}</p>
          <p>Спасибо за регистрацию в FinHub. Для завершения регистрации подтвердите ваш email адрес.</p>
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
            Если вы не регистрировались в FinHub, просто проигнорируйте это письмо.
          </p>
        </div>
      `,
    });

    console.warn("Email успешно отправлен на:", email);
    return { success: true };
  } catch (error: any) {
    console.error("Ошибка отправки email:", error);
    return { error: error.message || "Не удалось отправить email" };
  }
}
