import json
from decimal import Decimal
from django.db import transaction
from django.utils.timezone import now
from django.db.models import Q, Count
from django.http import JsonResponse
from django.views.generic import TemplateView, View
from pretix.control.permissions import EventPermissionRequiredMixin
from pretix.base.models import Order, OrderPosition, OrderPayment, OrderRefund, Item, ItemVariation, SalesChannel

class POSDashboardView(EventPermissionRequiredMixin, TemplateView):
    template_name = 'pretix_picklePOS/frontdesk.html' 
    
    # Require permission to view and change orders
    permission = 'can_change_orders' 

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        
        # Fetch all active items (tickets/products) for the current event
        # We prefetch variations in case you have tickets with different tiers/types
        ctx['items'] = self.request.event.items.prefetch_related(
            'variations'
        ).filter(active=True)
        
        return ctx

class POSCheckoutView(EventPermissionRequiredMixin, View):
    permission = 'can_change_orders'

    def post(self, request, *args, **kwargs):
        try:
            data = json.loads(request.body)
            cart = data.get('cart', [])
            edit_code = data.get('edit_order_code') # Check if we are editing an order
            
            if not cart and not edit_code:
                return JsonResponse({'success': False, 'error': 'Cart is empty'}, status=400)

            sales_channel, created = SalesChannel.objects.get_or_create(
                organizer=request.event.organizer,
                identifier='picklePOS',
                defaults={
                    'type': 'picklePOS'
                }
            )

            with transaction.atomic():
                total = Decimal('0.00')
                positions_to_create = []
                
                # 1. Gather items securely and calculate the true total
                for cart_item in cart:
                    item = Item.objects.get(id=cart_item['item'], event=request.event)
                    variation = None
                    if cart_item.get('variation'):
                        variation = ItemVariation.objects.get(id=cart_item['variation'], item=item)
                        
                    price = variation.price if variation and variation.price is not None else item.default_price
                    qty = cart_item['qty']
                    
                    for _ in range(qty):
                        positions_to_create.append({
                            'item': item,
                            'variation': variation,
                            'price': price,
                        })
                        total += price

                if edit_code:
                    # --- EDIT MODE ---
                    order = Order.objects.get(code=edit_code, event=request.event)
                    
                    # Calculate net amount currently paid (confirmed payments minus completed refunds)
                    paid_sum = sum(p.amount for p in order.payments.filter(state=OrderPayment.PAYMENT_STATE_CONFIRMED))
                    refunded_sum = sum(r.amount for r in order.refunds.filter(state=OrderRefund.REFUND_STATE_DONE))
                    current_paid = paid_sum - refunded_sum
                    
                    # Delete old positions and clear old financial transactions safely
                    order.positions.all().delete()
                    
                    # Update order total
                    order.total = total
                    order.save(update_fields=['total'])
                    
                    # Create new positions
                    for pos in positions_to_create:
                        OrderPosition.objects.create(
                            order=order,
                            item=pos['item'],
                            variation=pos['variation'],
                            price=pos['price'],
                        )
                    
                    # Update Pretix financial ledger
                    order.create_transactions()
                    
                    # Balance the payments/refunds based on the difference from what was actually paid
                    diff = total - current_paid
                    if diff > 0:
                        # Customer needs to pay more (price increased)
                        order.payments.create(
                            provider='pay_at_entrance',
                            amount=diff,
                            state=OrderPayment.PAYMENT_STATE_CONFIRMED,
                            payment_date=now()
                        )
                    elif diff < 0:
                        # Customer needs to be refunded (price decreased)
                        OrderRefund.objects.create(
                            order=order,
                            source=OrderRefund.REFUND_SOURCE_ADMIN,
                            state=OrderRefund.REFUND_STATE_DONE,
                            amount=abs(diff),
                            execution_date=now()
                        )
                            
                    if order.status != Order.STATUS_PAID:
                        order.status = Order.STATUS_PAID
                        order.save(update_fields=['status'])
                            
                else:
                    # --- NEW ORDER MODE ---
                    order = Order(
                        status=Order.STATUS_PENDING,
                        event=request.event,
                        email='pos-sales@example.invalid',
                        datetime=now(),
                        expires=now(),
                        total=total,
                        locale=request.event.settings.locale,
                        sales_channel=sales_channel,
                    )
                    order.save()
                    
                    for pos in positions_to_create:
                        OrderPosition.objects.create(
                            order=order,
                            item=pos['item'],
                            variation=pos['variation'],
                            price=pos['price'],
                        )
                        
                    order.create_transactions()
                    
                    payment = order.payments.create(
                        provider='pay_at_entrance',
                        amount=total,
                        state=OrderPayment.PAYMENT_STATE_CREATED,
                        payment_date=now()
                    )
                    payment.confirm(force=True, send_mail=False)

            return JsonResponse({
                'success': True, 
                'order_code': order.code,
                'message': 'Order successfully ' + ('updated' if edit_code else 'created') + '!'
            })

        except Item.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Item not found'}, status=400)
        except Order.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Order to edit not found'}, val=400)
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)

class POSSearchView(EventPermissionRequiredMixin, View):
    permission = 'can_change_orders'

    def get(self, request, *args, **kwargs):
        query = request.GET.get('q', '').strip()
        if not query:
            return JsonResponse({'results': []})

        # Search by order code or email, ignoring canceled orders. Limit to 5 results.
        orders = Order.objects.filter(
            event=request.event
        ).filter(
            Q(code__icontains=query) | 
            Q(email__icontains=query) |
            Q(invoice_address__name_cached__icontains=query)
        ).exclude(
            status=Order.STATUS_CANCELED
        ).select_related('invoice_address')[:5]

        results = []
        for order in orders:
            # Safely get the name if an invoice address exists
            name = ''
            if hasattr(order, 'invoice_address') and order.invoice_address:
                name = order.invoice_address.name_cached

            results.append({
                'code': order.code,
                'email': order.email,
                'name': name,
                'total': str(order.total),
                'status': order.status,
                'currency': request.event.currency
            })
        
        return JsonResponse({'results': results})

class POSLoadOrderView(EventPermissionRequiredMixin, View):
    permission = 'can_change_orders'

    def get(self, request, *args, **kwargs):
        code = request.GET.get('code')
        if not code:
            return JsonResponse({'error': 'No code provided'}, status=400)

        try:
            order = Order.objects.get(code=code, event=request.event)
        except Order.DoesNotExist:
            return JsonResponse({'error': 'Order not found'}, status=404)

        # Calculate what has actually been paid so far
        paid_sum = sum(p.amount for p in order.payments.filter(state=OrderPayment.PAYMENT_STATE_CONFIRMED))
        refunded_sum = sum(r.amount for r in order.refunds.filter(state=OrderRefund.REFUND_STATE_DONE))
        net_paid = paid_sum - refunded_sum

        # Count how many of each item/variation exist in this order
        positions = order.positions.values('item_id', 'variation_id').annotate(qty=Count('id'))
        
        return JsonResponse({
            'code': order.code,
            'status': order.status,
            'current_total': str(order.total),
            'net_paid': str(net_paid), # Send the actual paid amount to the frontend
            'positions': list(positions)
        })

class POSCancelOrderView(EventPermissionRequiredMixin, View):
    permission = 'can_change_orders'

    def post(self, request, *args, **kwargs):
        try:
            data = json.loads(request.body)
            order_code = data.get('order_code')

            if not order_code:
                return JsonResponse({'success': False, 'error': 'No order code provided'}, status=400)

            with transaction.atomic():
                order = Order.objects.get(code=order_code, event=request.event)

                if order.status == Order.STATUS_CANCELED:
                    return JsonResponse({'success': False, 'error': 'Order is already canceled'}, status=400)

                # Calculate net amount currently paid
                paid_sum = sum(p.amount for p in order.payments.filter(state=OrderPayment.PAYMENT_STATE_CONFIRMED))
                refunded_sum = sum(r.amount for r in order.refunds.filter(state=OrderRefund.REFUND_STATE_DONE))
                current_paid = paid_sum - refunded_sum

                # Automatically issue a refund for the amount already paid
                if current_paid > 0:
                    OrderRefund.objects.create(
                        order=order,
                        source=OrderRefund.REFUND_SOURCE_ADMIN,
                        state=OrderRefund.REFUND_STATE_DONE,
                        amount=current_paid,
                        execution_date=now()
                    )
                
                # Set the order status to canceled
                order.status = Order.STATUS_CANCELED
                order.save(update_fields=['status'])
                
                # Ensure the financial ledger is updated appropriately
                order.create_transactions()

            return JsonResponse({'success': True, 'message': f'Order {order.code} has been successfully canceled.'})

        except Order.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Order not found'}, status=404)
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'error': 'Invalid JSON data'}, status=400)
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)