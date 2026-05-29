import type { Request } from "express";

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
  sessionToken: string;
};
