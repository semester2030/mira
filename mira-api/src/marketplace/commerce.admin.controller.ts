import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminApiKeyGuard, AdminRequest } from '../common/guards/admin-api-key.guard';
import { adminActorFromId, CommerceService } from './commerce.service';

/**
 * Admin sees every partner. Mutations need a reason in `note`.
 * Served at /admin/commerce/* (matches the catalog-review admin routes) and /marketplace/commerce/admin/*.
 * Actor id comes from X-Admin-Actor when provided; otherwise "admin-key" (shared key, unnamed staff).
 */
@Controller(['admin/commerce', 'marketplace/commerce/admin'])
@UseGuards(AdminApiKeyGuard)
export class CommerceAdminController {
  constructor(@Inject(CommerceService) private readonly commerce: CommerceService) {}

  private actor(req: AdminRequest) {
    return adminActorFromId(req.adminActorId);
  }

  @Get('attention')
  attention(@Req() req: AdminRequest) {
    return this.commerce.listAttention(this.actor(req));
  }

  @Get('orders')
  orders(@Req() req: AdminRequest, @Query() query: Record<string, unknown>) {
    return this.commerce.listOrders(this.actor(req), query);
  }

  @Get('orders/:id')
  order(@Req() req: AdminRequest, @Param('id') id: string) {
    return this.commerce.getOrder(this.actor(req), id);
  }

  @Post('orders/:id/transition')
  transitionOrder(@Req() req: AdminRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.commerce.transitionOrderFor(this.actor(req), id, body);
  }

  @Post('orders/:id/collect-payment')
  collectPayment(@Req() req: AdminRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.commerce.collectPayment(this.actor(req), id, body);
  }

  @Post('orders/:id/waive-payment')
  waivePayment(@Req() req: AdminRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.commerce.waivePayment(this.actor(req), id, body);
  }

  @Get('bookings')
  bookings(@Req() req: AdminRequest, @Query() query: Record<string, unknown>) {
    return this.commerce.listBookings(this.actor(req), query);
  }

  @Get('bookings/:id')
  booking(@Req() req: AdminRequest, @Param('id') id: string) {
    return this.commerce.getBooking(this.actor(req), id);
  }

  @Post('bookings/:id/transition')
  transitionBooking(@Req() req: AdminRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.commerce.transitionBookingFor(this.actor(req), id, body);
  }
}
