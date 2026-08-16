import json
from decimal import Decimal
from django.utils.timezone import now
from django.db import transaction
from django.http import JsonResponse
from django.views.generic import TemplateView, View
from pretix.control.permissions import EventPermissionRequiredMixin
from pretix.base.models import Order, OrderPosition, Item, ItemVariation, OrderPayment, SalesChannel

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
            
            if not cart:
                return JsonResponse({'success': False, 'error': 'Cart is empty'}, status=400)

            with transaction.atomic():
                total = Decimal('0.00')
                positions_to_create = []
                
                # Fetch the default web sales channel
                channel = SalesChannel.objects.get(identifier="web")
                
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
                        
                # 2. Create the Order
                order = Order(
                    status=Order.STATUS_PENDING,
                    event=request.event,
                    email='pos-sales@localhost', # Placeholder email
                    datetime=now(),
                    expires=now(),
                    total=total,
                    locale=request.event.settings.locale,
                    sales_channel=channel,
                )
                order.save() 
                
                # 3. Create the individual tickets (OrderPositions)
                for pos in positions_to_create:
                    OrderPosition.objects.create(
                        order=order,
                        item=pos['item'],
                        variation=pos['variation'],
                        price=pos['price'],
                        attendee_name_parts={'_legacy': 'POS Sale'},
                    )
                    
                # Generate transactions for the order (this is important for Pretix's internal accounting)
                order.create_transactions()
                
                # 4. Create a cash payment (start it as PENDING/CREATED)
                payment = order.payments.create(
                    provider='manual',
                    amount=total,
                    state=OrderPayment.PAYMENT_STATE_CREATED,
                    payment_date=now()
                )
                
                # Use Pretix's built-in confirm method! 
                # This automatically changes the order status to PAID, generates 
                # invoices/tickets if configured, and handles the payment ledger.
                payment.confirm(force=True)

            return JsonResponse({
                'success': True, 
                'order_code': order.code,
                'message': 'Order created successfully!'
            })

        except Item.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Item not found'}, status=400)
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)