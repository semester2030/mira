import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { ADMIN_ACTOR, CommerceService } from './commerce.service';

/**
 * Admin sees every partner. Mutations need a reason in `note`.
 * Served at /admin/commerce/* (matches the catalog-review admin routes) and /marketplace/commerce/admin/*.
 */
@Controller(['admin/commerce', 'marketplace/commerce/admin'])
@UseGuards(AdminApiKeyGuard)
export class CommerceAdminController {
  constructor(@Inject(CommerceService) private readonly commerce: CommerceService) {}

  @Get('orders')
  orders(@Query() query: Record<string, unknown>) {
    return this.commerce.listOrders(ADMIN_ACTOR, query);
  }

  @Get('orders/:id')
  order(@Param('id') id: string) {
    return this.commerce.getOrder(ADMIN_ACTOR, id);
  }

  @Post('orders/:id/transition')
  transitionOrder(@Param('id') id: string, @Body() body: unknown) {
    return this.commerce.transitionOrderFor(ADMIN_ACTOR, id, body);
  }

  @Post('orders/:id/collect-payment')
  collectPayment(@Param('id') id: string, @Body() body: unknown) {
    return this.commerce.collectPayment(ADMIN_ACTOR, id, body);
  }

  @Post('orders/:id/waive-payment')
  waivePayment(@Param('id') id: string, @Body() body: unknown) {
    return this.commerce.waivePayment(ADMIN_ACTOR, id, body);
  }

  @Get('bookings')
  bookings(@Query() query: Record<string, unknown>) {
    return this.commerce.listBookings(ADMIN_ACTOR, query);
  }

  @Get('bookings/:id')
  booking(@Param('id') id: string) {
    return this.commerce.getBooking(ADMIN_ACTOR, id);
  }

  @Post('bookings/:id/transition')
  transitionBooking(@Param('id') id: string, @Body() body: unknown) {
    return this.commerce.transitionBookingFor(ADMIN_ACTOR, id, body);
  }
}
