import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminApiKeyGuard, AdminRequest } from '../common/guards/admin-api-key.guard';
import { adminActorFromId, CommerceService } from './commerce.service';

/**
 * Admin commerce ops. Read allowed for support + supervisor + shared key.
 * Mutations require supervisor (staff secret) or shared master key — never support.
 * Staff secret binds actorId; shared key may carry X-Admin-Actor as a display label only.
 */
@Controller(['admin/commerce', 'marketplace/commerce/admin'])
@UseGuards(AdminApiKeyGuard)
export class CommerceAdminController {
  constructor(@Inject(CommerceService) private readonly commerce: CommerceService) {}

  private actor(req: AdminRequest) {
    return adminActorFromId(req.adminActorId);
  }

  private assertCanMutate(req: AdminRequest) {
    if (req.adminCanMutate) return;
    throw new ForbiddenException({
      code: 'ADMIN_READ_ONLY',
      message: 'حساب الدعم للقراءة والمتابعة فقط. تعديل الحالة أو التحصيل يتطلب مشرفًا.',
      messageAr: 'حساب الدعم للقراءة والمتابعة فقط. تعديل الحالة أو التحصيل يتطلب مشرفًا.',
      role: req.adminRole,
      actorId: req.adminActorId,
    });
  }

  @Get('session')
  session(@Req() req: AdminRequest) {
    return {
      actorId: req.adminActorId,
      role: req.adminRole,
      canMutate: req.adminCanMutate,
      source: req.adminAuthSource,
      labelAr:
        req.adminRole === 'support'
          ? `دعم · ${req.adminActorId} (قراءة فقط)`
          : req.adminRole === 'supervisor'
            ? `مشرف · ${req.adminActorId}`
            : req.adminActorId === 'admin-key'
              ? 'مفتاح الإدارة المشترك (بلا موظف مسمّى)'
              : `مفتاح مشترك · تسمية ${req.adminActorId}`,
    };
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
    this.assertCanMutate(req);
    return this.commerce.transitionOrderFor(this.actor(req), id, body);
  }

  @Post('orders/:id/collect-payment')
  collectPayment(@Req() req: AdminRequest, @Param('id') id: string, @Body() body: unknown) {
    this.assertCanMutate(req);
    return this.commerce.collectPayment(this.actor(req), id, body);
  }

  @Post('orders/:id/waive-payment')
  waivePayment(@Req() req: AdminRequest, @Param('id') id: string, @Body() body: unknown) {
    this.assertCanMutate(req);
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
    this.assertCanMutate(req);
    return this.commerce.transitionBookingFor(this.actor(req), id, body);
  }
}
