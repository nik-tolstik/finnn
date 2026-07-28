# Account Personal Visibility

The user requested a personal hide/show action in the account actions dialog so users can hide their own accounts from
the dashboard. Hidden accounts must remain available in the `Все счета` view and in financial operation forms.

Implementation constraints:

- Store visibility on the server per authenticated user.
- Do not make hiding a workspace-wide account state.
- Keep the existing NestJS API, OpenAPI, Orval, and TanStack Query architecture.
- Implement on `feature/account-personal-visibility`, based on `develop`.
