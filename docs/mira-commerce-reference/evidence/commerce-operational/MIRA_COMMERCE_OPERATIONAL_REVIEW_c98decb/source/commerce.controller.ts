import { Body, Controller, Delete, Get, Headers, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CommerceService } from './commerce.service';

/** Customer cart, COD orders and service bookings. Every route except availability needs a signed-in user. */
@Controller('marketplace/commerce')
export class CommerceController {
  constructor(@Inject(CommerceService) private readonly commerce: CommerceService) {}

  // ---- cart ----

  @Get('cart')
  @UseGuards(FirebaseAuthGuard)
  async cart(@CurrentUser() user: RequestUser) {
    return this.commerce.getCart(await this.commerce.customerActor(user));
  }

  /** Ensures the cart exists and returns it (same shape as GET). */
  @Post('cart')
  @UseGuards(FirebaseAuthGuard)
  async ensureCart(@CurrentUser() user: RequestUser) {
    return this.commerce.getCart(await this.commerce.customerActor(user));
  }

  @Delete('cart')
  @UseGuards(FirebaseAuthGuard)
  async clearCart(@CurrentUser() user: RequestUser) {
    return this.commerce.clearCart(await this.commerce.customerActor(user));
  }

  @Post('cart/items')
  @UseGuards(FirebaseAuthGuard)
  async addItem(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.commerce.addCartItem(await this.commerce.customerActor(user), body);
  }

  @Patch('cart/items/:id')
  @UseGuards(FirebaseAuthGuard)
  async updateItem(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() body: unknown) {
    return this.commerce.updateCartItem(await this.commerce.customerActor(user), id, body);
  }

  @Delete('cart/items/:id')
  @UseGuards(FirebaseAuthGuard)
  async removeItem(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.commerce.removeCartItem(await this.commerce.customerActor(user), id);
  }

  @Post('checkout/quote')
  @UseGuards(FirebaseAuthGuard)
  async quote(@CurrentUser() user: RequestUser) {
    return this.commerce.quote(await this.commerce.customerActor(user));
  }

  // ---- orders ----

  @Post('orders')
  @UseGuards(FirebaseAuthGuard)
  async createOrder(
    @CurrentUser() user: RequestUser,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.commerce.createOrder(await this.commerce.customerActor(user), body, idempotencyKey);
  }

  @Get('orders')
  @UseGuards(FirebaseAuthGuard)
  async orders(@CurrentUser() user: RequestUser, @Query() query: Record<string, unknown>) {
    return this.commerce.listCustomerOrders(await this.commerce.customerActor(user), query);
  }

  @Get('orders/:id')
  @UseGuards(FirebaseAuthGuard)
  async order(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.commerce.getCustomerOrder(await this.commerce.customerActor(user), id);
  }

  @Post('orders/:id/cancel')
  @UseGuards(FirebaseAuthGuard)
  async cancelOrder(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() body: unknown) {
    return this.commerce.cancelCustomerOrder(await this.commerce.customerActor(user), id, body);
  }

  // ---- bookings ----

  @Get('services/:id/availability')
  availability(@Param('id') id: string, @Query('date') date?: string) {
    return this.commerce.serviceAvailability(id, date);
  }

  @Post('bookings')
  @UseGuards(FirebaseAuthGuard)
  async createBooking(
    @CurrentUser() user: RequestUser,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.commerce.createBooking(await this.commerce.customerActor(user), body, idempotencyKey);
  }

  @Get('bookings')
  @UseGuards(FirebaseAuthGuard)
  async bookings(@CurrentUser() user: RequestUser, @Query() query: Record<string, unknown>) {
    return this.commerce.listCustomerBookings(await this.commerce.customerActor(user), query);
  }

  @Get('bookings/:id')
  @UseGuards(FirebaseAuthGuard)
  async booking(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.commerce.getCustomerBooking(await this.commerce.customerActor(user), id);
  }

  @Post('bookings/:id/cancel')
  @UseGuards(FirebaseAuthGuard)
  async cancelBooking(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() body: unknown) {
    return this.commerce.cancelCustomerBooking(await this.commerce.customerActor(user), id, body);
  }
}
