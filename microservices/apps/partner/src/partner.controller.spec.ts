import { Test, TestingModule } from '@nestjs/testing';
import { PartnerController } from './partner.controller';
import { PartnerService } from './partner.service';

describe('PartnerController', () => {
  let partnerController: PartnerController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [PartnerController],
      providers: [PartnerService],
    }).compile();

    partnerController = app.get<PartnerController>(PartnerController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(partnerController.getHello()).toBe('Hello World!');
    });
  });
});
