interface WorkspaceBase {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  baseCurrency: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type WorkspaceWithOwner = WorkspaceBase & {
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

export type WorkspaceWithMembers = WorkspaceBase & {
  owner: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  members: {
    role: string;
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
  }[];
};

export interface WorkspaceSummary {
  id: string;
  name: string;
  icon: string | null;
  baseCurrency: string;
  ownerId: string;
}
