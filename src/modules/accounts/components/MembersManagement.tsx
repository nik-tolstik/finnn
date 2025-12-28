"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { User, UserPlus } from "lucide-react";
import { useState } from "react";

import { getWorkspace, getWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { Button } from "@/shared/ui/button";

import { InviteMemberDialog } from "./InviteMemberDialog";

interface MembersManagementProps {
  workspaceId: string;
}

export function MembersManagement({ workspaceId }: MembersManagementProps) {
  const { data: session } = useSession();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const { data: membersData } = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => getWorkspaceMembers(workspaceId),
  });

  const { data: workspaceData } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => getWorkspace(workspaceId),
  });

  const members = membersData?.data || [];
  const workspace = workspaceData?.data;
  const isOwner = workspace?.ownerId === session?.user?.id;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Участники</h3>
          {isOwner && (
            <Button
              size="sm"
              onClick={() => setInviteDialogOpen(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Пригласить
            </Button>
          )}
        </div>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет участников</p>
        ) : (
          <div className="space-y-1.5">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-2 border rounded-md"
              >
                {member.image ? (
                  <img
                    src={member.image}
                    alt={member.name || member.email}
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {member.name || "Без имени"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {member.email}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {workspace && (
        <InviteMemberDialog
          workspaceId={workspaceId}
          workspaceName={workspace.name}
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
        />
      )}
    </div>
  );
}

