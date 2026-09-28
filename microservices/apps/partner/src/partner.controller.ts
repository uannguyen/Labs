import { Controller, Get } from '@nestjs/common';
import { PartnerService } from './partner.service';

@Controller()
export class PartnerController {
  constructor(private readonly partnerService: PartnerService) {}

  @Get()
  getHello(): string {
    return this.partnerService.getHello();
  }
}
