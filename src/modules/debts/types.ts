import { Debt, User } from "@prisma/client";

export type DebtWithUsers = Debt & {
  fromUser: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  toUser: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
};

