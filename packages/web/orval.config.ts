import { defineConfig } from "orval";

export default defineConfig({
  finnn: {
    input: {
      target: "../api/openapi.json",
    },
    output: {
      mode: "tags-split",
      target: "src/shared/api/generated/finnn.ts",
      schemas: "src/shared/api/generated/model",
      client: "react-query",
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: "./src/shared/api/http-client.ts",
          name: "apiClient",
        },
        query: {
          signal: true,
          useMutation: true,
          useQuery: true,
        },
      },
    },
    hooks: {
      afterAllFilesWrite: "biome check src/shared/api --write",
    },
  },
});
