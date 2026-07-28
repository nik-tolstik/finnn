import { defineConfig } from "orval";

export default defineConfig({
  finnn: {
    input: {
      target: "../api/openapi.json",
    },
    output: {
      mode: "tags-split",
      packageJson: "./orval.package.json",
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
        operations: {
          // The protected redirect is consumed by an <img>, not TanStack Query.
          getCategoryIcon: {
            query: {
              useMutation: false,
              useQuery: false,
            },
          },
        },
      },
    },
    hooks: {
      afterAllFilesWrite: "biome check src/shared/api --write",
    },
  },
});
