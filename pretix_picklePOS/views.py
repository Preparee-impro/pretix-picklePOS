from django.views.generic import TemplateView
from pretix.control.permissions import EventPermissionRequiredMixin
from pretix.base.models import Item

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