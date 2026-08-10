import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from './session.guard';

@Controller()
export class MeController {
  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() req: Request) {
    return req.user;
  }
}
