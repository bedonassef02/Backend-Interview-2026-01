import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Successfully uploaded 100 records' })
  message!: string;

  @ApiProperty({ example: 100 })
  recordsInserted!: number;

  @ApiProperty({ example: 0 })
  recordsFailed!: number;

  @ApiProperty({ example: 150 })
  totalRecordsInDb!: number;

  @ApiProperty({ example: '245ms' })
  processingTime!: string;

  @ApiProperty({ required: false, type: [String] })
  errors?: string[];
}
