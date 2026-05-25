import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

const CATEGORY_TYPES = ["income", "expense"] as const;

export class CreateCategoryDto {
  @ApiProperty({ example: "Groceries", maxLength: 100, minLength: 1, type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: CATEGORY_TYPES, example: "expense", type: String })
  @IsIn(CATEGORY_TYPES)
  type!: string;

  @ApiPropertyOptional({ example: "shopping-cart", type: String })
  @IsOptional()
  @IsString()
  icon?: string;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: "Salary", maxLength: 100, minLength: 1, type: String })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: CATEGORY_TYPES, example: "income", type: String })
  @IsOptional()
  @IsIn(CATEGORY_TYPES)
  type?: string;

  @ApiPropertyOptional({ example: "briefcase", type: String })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: 0, type: Number })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateCategoriesOrderDto {
  @ApiProperty({ example: ["665f5d865ef5a20c0d2f1111", "665f5d865ef5a20c0d2f2222"], type: [String] })
  @IsArray()
  @IsString({ each: true })
  categoryIds!: string[];
}

export class CategoryDto {
  @ApiProperty({ example: "665f5d865ef5a20c0d2f1111", type: String })
  id!: string;

  @ApiProperty({ example: "665f5d865ef5a20c0d2f3333", type: String })
  workspaceId!: string;

  @ApiProperty({ example: "Groceries", type: String })
  name!: string;

  @ApiProperty({ example: "expense", type: String })
  type!: string;

  @ApiPropertyOptional({ example: "shopping-cart", nullable: true, type: String })
  icon!: string | null;

  @ApiProperty({ example: 0, type: Number })
  order!: number;

  @ApiProperty({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  createdAt!: string;

  @ApiProperty({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  updatedAt!: string;

  @ApiProperty({ example: 4, type: Number })
  transactionCount!: number;
}

export class CategoryResponseDto {
  @ApiProperty({ type: CategoryDto })
  category!: CategoryDto;
}

export class CategoryListResponseDto {
  @ApiProperty({ type: [CategoryDto] })
  categories!: CategoryDto[];
}

export class CategorySuccessResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;
}

export class CategoryTransactionCountResponseDto {
  @ApiProperty({ example: 4, type: Number })
  count!: number;
}
