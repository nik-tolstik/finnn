# Category Icons

Category icons are optional metadata on `Category` records. The `icon` field stores a curated emoji or a legacy Lucide
identifier. The `iconAssetId` field references a workspace-scoped `CategoryIconAsset` when a user uploads an image.
The two fields are mutually exclusive when selected through the API.

## Uploads

Uploads use the same private S3-compatible bucket configuration as avatars (`AVATAR_BUCKET_*`). The API accepts PNG,
JPEG, and WebP files up to 2 MB. It validates both the declared MIME type and the file signature before writing the
object. Object keys are generated under `category-icons/<workspaceId>/`; the original filename is never persisted.

Uploaded assets are shared by all categories in a workspace, and the picker lists them in reverse creation order under
`Загруженные`. Each uploaded asset shows its delete control on hover.

## API

- `GET /workspaces/:workspaceId/category-icons` lists assets available to the current workspace member.
- `POST /workspaces/:workspaceId/category-icons` accepts a multipart `file` field and returns the new asset.
- `GET /category-icons/:iconId` checks workspace access and redirects to a short-lived presigned object URL. The redirect
  response is non-cacheable because its target expires.
- `DELETE /category-icons/:iconId` deletes an unused asset after deleting its object from storage. It returns `409 Conflict`
  with the number of categories when the asset is still assigned to one or more categories.
- Category create/update requests accept nullable `icon` and `iconAssetId` fields.

All icon endpoints require the normal authenticated, verified session. The API also rejects an asset ID that belongs to a
different workspace.

## Web UI

`CategoryIcon` is the shared renderer used by category management, selectors, transaction rows, scheduled payment
forms, filters, and analytics. Uploaded images have priority, known legacy Lucide identifiers remain supported, and
missing or unknown values render a muted question-mark container with the accessible label `Иконка не выбрана`.

`CategoryIconPicker` uses a Popover at desktop widths and a bottom Sheet on mobile. The picker has `Иконки` and
`Загрузить` tabs, a scrollable content area, and an action to clear the current icon on the category card. Category
management keeps the name input and icon picker available inline: names save on blur or Enter, while icon selection and
clearing save immediately. The drag handle remains available for changing order. The upload tab shows light/dark
previews before upload. The emoji search covers emoji values, group names, and static Russian/English tags. Uploaded
assets remain available in their separate `Загруженные` section, and an empty emoji search result does not hide it.
Newly uploaded assets are selected automatically and successful deletions remove the asset from the TanStack Query cache
optimistically. Uploaded and emoji items use the same accent background on hover.

Storage deletion is performed before deleting the database row. If storage fails, the database record remains in its
protected deletion state so a later `DELETE` request can retry safely. Before storage deletion, the API marks the asset
as deleting in a MongoDB transaction. New
assignments lock the same record in their own transaction, so an asset cannot become assigned between the usage check
and object deletion. Assets marked as deleting are hidden from lists and cannot be read or assigned. An assigned asset
cannot be deleted; the category must first be cleared or changed.
