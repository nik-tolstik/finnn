import { SetMetadata } from "@nestjs/common";

import type { WorkspaceRole } from "./workspace.constants";

export const WORKSPACE_ROLES_METADATA = "workspace:roles";
export const WORKSPACE_PARAM_METADATA = "workspace:param";

export function WorkspaceRoles(...roles: WorkspaceRole[]) {
  return SetMetadata(WORKSPACE_ROLES_METADATA, roles);
}

export function WorkspaceParam(paramName: string) {
  return SetMetadata(WORKSPACE_PARAM_METADATA, paramName);
}
