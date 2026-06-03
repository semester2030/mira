import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SubmitWebsiteLeadDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(180)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsIn(['contact', 'partnership', 'media', 'support'])
  type?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message!: string;
}
