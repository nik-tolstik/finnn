interface WorkspaceBase {
  id: string;
  name: string;
  slug: string;
  baseCurrency: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type WorkspaceWithOwner = WorkspaceBase & {
  owner: {
    id: string;
    name: string | null;
    email?: string | null;
    image: string | null;
  };
  _count: {
    members: number;
  };
};

export type WorkspaceWithMembers = WorkspaceBase & {
  owner: {
    id: string;
    name: string | null;
    email?: string | null;
    image: string | null;
  };
  members: {
    role: string;
    user: {
      id: string;
      name: string | null;
      email?: string | null;
      image: string | null;
    };
  }[];
};

export interface WorkspaceSummary {
  id: string;
  name: string;
  baseCurrency: string;
  ownerId: string;
}
