import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min, Max } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number (1-based)',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    example: 100,
    description: 'Records per page (max 500)',
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit: number = 100;
}

export class PaginatedResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 50 })
  count!: number;

  @ApiProperty({ example: 1234 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 13 })
  totalPages!: number;

  @ApiProperty({ type: [Object] })
  records!: any[];
}
