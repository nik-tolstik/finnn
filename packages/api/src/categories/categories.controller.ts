import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiFoundResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { AuthGuard } from "@/auth/auth.guard";
import type { AuthenticatedUser } from "@/auth/auth.types";
import { CurrentUser } from "@/auth/current-user.decorator";
import { EmailVerifiedGuard } from "@/auth/email-verified.guard";
import { AUTH_COOKIE_NAME } from "@/auth/session-cookie";
import { ApiErrorDto } from "@/common/api-error.dto";

import {
  CategoryIconListResponseDto,
  CategoryIconResponseDto,
  CategoryListResponseDto,
  CategoryResponseDto,
  CategorySuccessResponseDto,
  CategoryTransactionCountResponseDto,
  CreateCategoryDto,
  UpdateCategoriesOrderDto,
  UpdateCategoryDto,
  UploadCategoryIconDto,
} from "./categories.dto";
import { CategoriesService } from "./categories.service";

@Controller()
@ApiTags("Categories")
@UseGuards(AuthGuard, EmailVerifiedGuard)
@ApiCookieAuth(AUTH_COOKIE_NAME)
export class CategoriesController {
  constructor(@Inject(CategoriesService) private readonly categoriesService: CategoriesService) {}

  @Post("workspaces/:workspaceId/categories")
  @ApiOperation({ operationId: "createCategory", summary: "Create a category" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiBody({ type: CreateCategoryDto })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async createCategory(
    @Param("workspaceId") workspaceId: string,
    @Body() body: CreateCategoryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.categoriesService.createCategory(workspaceId, body, user);
  }

  @Get("workspaces/:workspaceId/categories")
  @ApiOperation({ operationId: "listCategories", summary: "List categories" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiQuery({ enum: ["income", "expense"], name: "type", required: false, type: String })
  @ApiOkResponse({ type: CategoryListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async listCategories(
    @Param("workspaceId") workspaceId: string,
    @Query("type") type: string | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.categoriesService.listCategories(workspaceId, type, user);
  }

  @Get("workspaces/:workspaceId/category-icons")
  @ApiOperation({ operationId: "listCategoryIcons", summary: "List uploaded category icons" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiOkResponse({ type: CategoryIconListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async listCategoryIcons(@Param("workspaceId") workspaceId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.categoriesService.listCategoryIcons(workspaceId, user);
  }

  @Post("workspaces/:workspaceId/category-icons")
  @HttpCode(200)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 2 * 1024 * 1024 } }))
  @ApiOperation({ operationId: "uploadCategoryIcon", summary: "Upload a category icon" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: UploadCategoryIconDto })
  @ApiOkResponse({ type: CategoryIconResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async uploadCategoryIcon(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.categoriesService.uploadCategoryIcon(workspaceId, user, file);
  }

  @Get("category-icons/:iconId")
  @ApiOperation({ operationId: "getCategoryIcon", summary: "Redirect to an uploaded category icon" })
  @ApiParam({ name: "iconId", type: String })
  @ApiFoundResponse({
    description: "Redirects to a short-lived private bucket URL.",
    headers: {
      Location: {
        description: "Short-lived presigned category icon URL.",
        schema: { type: "string" },
      },
      "Cache-Control": {
        description: "Prevents clients from caching a short-lived presigned URL.",
        schema: { example: "no-store, max-age=0", type: "string" },
      },
    },
  })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorDto })
  async getCategoryIcon(
    @Param("iconId") iconId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: import("express").Response
  ) {
    const url = await this.categoriesService.getCategoryIconReadUrl(iconId, user);
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.status(302).setHeader("Location", url).end();
  }

  @Delete("category-icons/:iconId")
  @HttpCode(204)
  @ApiOperation({ operationId: "deleteCategoryIcon", summary: "Delete an uploaded category icon" })
  @ApiParam({ name: "iconId", type: String })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorDto })
  async deleteCategoryIcon(@Param("iconId") iconId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.categoriesService.deleteCategoryIcon(iconId, user);
  }

  @Patch("workspaces/:workspaceId/categories/order")
  @ApiOperation({ operationId: "updateCategoriesOrder", summary: "Update category order" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiBody({ type: UpdateCategoriesOrderDto })
  @ApiOkResponse({ type: CategorySuccessResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async updateCategoriesOrder(
    @Param("workspaceId") workspaceId: string,
    @Body() body: UpdateCategoriesOrderDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.categoriesService.updateCategoriesOrder(workspaceId, body, user);
  }

  @Patch("categories/:categoryId")
  @ApiOperation({ operationId: "updateCategory", summary: "Update a category" })
  @ApiParam({ name: "categoryId", type: String })
  @ApiBody({ type: UpdateCategoryDto })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async updateCategory(
    @Param("categoryId") categoryId: string,
    @Body() body: UpdateCategoryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.categoriesService.updateCategory(categoryId, body, user);
  }

  @Delete("categories/:categoryId")
  @HttpCode(204)
  @ApiOperation({ operationId: "deleteCategory", summary: "Delete a category" })
  @ApiParam({ name: "categoryId", type: String })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async deleteCategory(@Param("categoryId") categoryId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.categoriesService.deleteCategory(categoryId, user);
  }

  @Get("categories/:categoryId/transaction-count")
  @ApiOperation({ operationId: "getCategoryTransactionCount", summary: "Get category transaction count" })
  @ApiParam({ name: "categoryId", type: String })
  @ApiOkResponse({ type: CategoryTransactionCountResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async getCategoryTransactionCount(@Param("categoryId") categoryId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.categoriesService.getCategoryTransactionCount(categoryId, user);
  }
}
