# Register your receivers here
from django.dispatch import receiver
from django.urls import reverse, resolve
from django.utils.translation import gettext_lazy as _
from django.templatetags.static import static
from pretix.base.signals import register_sales_channel_types, register_payment_providers
from pretix.control.signals import nav_event
from pretix.presale.signals import html_head
from .channels import PicklePOSSalesChannelType
from .payment import PayAtEntrance

@receiver(register_sales_channel_types, dispatch_uid="picklePOS_register_channel")
def register_channels(sender, **kwargs):
    return PicklePOSSalesChannelType()

@receiver(register_payment_providers, dispatch_uid="picklepos_payment_provider")
def register_payment_provider(sender, **kwargs):
    return PayAtEntrance

@receiver(nav_event, dispatch_uid="picklePOS_nav")
def frontdesk_nav(sender, request, **kwargs):
    url = resolve(request.path_info)

    return [{
        "label": _("Front Desk"),
        "icon": "ticket",
        "url": reverse(
            "plugins:pretix_picklePOS:pos_dashboard",
            kwargs={
                "organizer": request.organizer.slug,
                "event": request.event.slug,
            }
        ),
        "active": (
            url.namespace == "plugins:pretix_picklePOS"
            and url.url_name == "pos_dashboard"
        )
    }]

@receiver(html_head, dispatch_uid="picklepos_presale_html_head")
def presale_html_head(sender, request=None, **kwargs):
    # Inject our static JS file into the <head> of the customer pages
    url = static('pretix_picklePOS/presale.js')
    return f'<script src="{url}"></script>'