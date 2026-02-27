import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'admin',
    description: 'Username for the web interface',
  })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({
    example: 'admin123',
    description: 'Password for the web interface',
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
