import { createRouteHandler } from "uploadthing/next";

import { ourFileRouter } from "./core";

const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});

export { GET, POST };
