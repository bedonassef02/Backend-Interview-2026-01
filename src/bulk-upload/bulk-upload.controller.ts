import {
  Controller,
  Post,
  Get,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  ParseFilePipe,
  MaxFileSizeValidator,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BulkUploadService } from './bulk-upload.service';
import { UploadResponseDto } from './dto/upload-response.dto';

@ApiTags('Bulk Upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB max limit
        ],
        exceptionFactory: (error) =>
          new BadRequestException(`File validation failed: ${error}`),
      }),
    )
    file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.bulkUploadService.processCSV(file.buffer, file.originalname);
  }

  @Get('records')
  @ApiOperation({ summary: 'Get all processed upload records' })
  @ApiResponse({
    status: 200,
    description: 'Returns all records from the simulated database',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRecords() {
    const records = await this.bulkUploadService.getRecords();
    return { success: true, count: records.length, records };
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
