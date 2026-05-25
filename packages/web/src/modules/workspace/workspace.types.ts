import type { Workspace, WorkspaceMember } from "@prisma/client";

export type WorkspaceWithOwner = Workspace & {
  owner: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  _count: {
    members: number;
  };
};

export type WorkspaceWithMembers = Workspace & {
  owner: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  members: (WorkspaceMember & {
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
  })[];
};

export interface WorkspaceSummary {
  id: string;
  name: string;
  icon: string | null;
  baseCurrency: string;
  ownerId: string;
}
