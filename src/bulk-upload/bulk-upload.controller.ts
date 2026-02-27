import {
  Controller,
  Post,
  Get,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtOrApiKeyGuard } from '../auth/guards/jwt-or-apikey.guard';
import { BulkUploadService } from './bulk-upload.service';
import { UploadResponseDto } from './dto/upload-response.dto';
import { PaginationQueryDto, PaginatedResponseDto } from './dto/pagination.dto';
import { createParseFilePipe } from '../common/files/files-validation-factory';
import { FileSizeType, FileType } from '../common/files/types/file.types';
import { NonEmptyArray } from '../common/files/utils/array.util';

const MAX_UPLOAD_SIZE: FileSizeType = '10MB';
const ALLOWED_FILE_TYPES: NonEmptyArray<FileType> = ['csv'];

@ApiTags('Bulk Upload')
@ApiBearerAuth('JWT')
@UseGuards(JwtOrApiKeyGuard)
@Controller('api/bulk-upload')
export class BulkUploadController {
  constructor(private readonly bulkUploadService: BulkUploadService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a CSV file for bulk record insertion' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV file to upload (Max 10MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Records uploaded successfully',
    type: UploadResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid file or CSV format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async uploadCSV(
    @UploadedFile(createParseFilePipe(MAX_UPLOAD_SIZE, ALLOWED_FILE_TYPES))
    file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.bulkUploadService.processCSV(file.buffer, file.originalname);
  }

  @Get('records')
  @ApiOperation({ summary: 'Get processed upload records (paginated)' })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated records from the simulated database',
    type: PaginatedResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRecords(
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto> {
    const allRecords = await this.bulkUploadService.getRecords();
    const total = allRecords.length;
    const { page, limit } = query;
    const start = (page - 1) * limit;
    const records = allRecords.slice(start, start + limit);

    return {
      success: true,
      count: records.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      records,
    };
  }

  @Delete('records')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all records from the database' })
  @ApiResponse({ status: 200, description: 'Database cleared' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async resetDatabase() {
    return this.bulkUploadService.resetDatabase();
  }
}
