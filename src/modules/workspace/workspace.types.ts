import { Workspace, WorkspaceMember } from "@prisma/client";

export type WorkspaceWithOwner = Workspace & {
  owner: {
    id: string;
    name: string | null;
    email: string;
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

