import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
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
  CategoryListResponseDto,
  CategoryResponseDto,
  CategorySuccessResponseDto,
  CategoryTransactionCountResponseDto,
  CreateCategoryDto,
  UpdateCategoriesOrderDto,
  UpdateCategoryDto,
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
