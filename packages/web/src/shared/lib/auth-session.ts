import { getServerSession } from "next-auth";
import { cache } from "react";

import { authOptions } from "./auth";

export const getCachedServerSession = cache(() => getServerSession(authOptions));
