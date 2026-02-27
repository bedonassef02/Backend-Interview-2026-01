import { ApiProperty } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty({ example: 'admin', description: 'Username from JWT payload' })
  username!: string;

  @ApiProperty({ example: 'admin', description: 'User role from JWT payload' })
  role!: string;
}
