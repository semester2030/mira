import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PartnerRequest, PartnerTokenGuard } from '../partners-portal/guards/partner-token.guard';
import { CommerceService, partnerActor } from './commerce.service';

/** Partner-scoped orders and bookings. The partnerId always comes from the token, never from the request. */
@Controller('partners/me/commerce')
@UseGuards(PartnerTokenGuard)
export class CommercePartnerController {
  constructor(@Inject(CommerceService) private readonly commerce: CommerceService) {}

  private actor(req: PartnerRequest) {
    return partnerActor(req.partnerUser.id, req.partnerUser.partnerId);
  }

  @Get('orders')
  orders(@Req() req: PartnerRequest, @Query() query: Record<string, unknown>) {
    return this.commerce.listOrders(this.actor(req), query);
  }

  @Get('orders/:id')
  order(@Req() req: PartnerRequest, @Param('id') id: string) {
    return this.commerce.getOrder(this.actor(req), id);
  }

  @Post('orders/:id/transition')
  transitionOrder(@Req() req: PartnerRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.commerce.transitionOrderFor(this.actor(req), id, body);
  }

  @Post('orders/:id/collect-payment')
  collectPayment(@Req() req: PartnerRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.commerce.collectPayment(this.actor(req), id, body);
  }

  @Get('bookings')
  bookings(@Req() req: PartnerRequest, @Query() query: Record<string, unknown>) {
    return this.commerce.listBookings(this.actor(req), query);
  }

  @Get('bookings/:id')
  booking(@Req() req: PartnerRequest, @Param('id') id: string) {
    return this.commerce.getBooking(this.actor(req), id);
  }

  /** Body: { status: confirmed | rejected | completed | cancelled, note? } */
  @Post('bookings/:id/transition')
  transitionBooking(@Req() req: PartnerRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.commerce.transitionBookingFor(this.actor(req), id, body);
  }

  @Get('services/:id/availability')
  availability(@Req() req: PartnerRequest, @Param('id') id: string, @Query('date') date?: string) {
    return this.commerce.serviceAvailability(id, date, req.partnerUser.partnerId);
  }
}
