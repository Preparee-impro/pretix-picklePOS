# Register your receivers here
from django.dispatch import receiver
from django.urls import reverse, resolve
from django.utils.translation import gettext_lazy as _
from pretix.base.signals import register_sales_channel_types
from pretix.control.signals import nav_event
from .channels import PicklePOSSalesChannelType

@receiver(register_sales_channel_types, dispatch_uid="picklePOS_register_channel")
def register_channels(sender, **kwargs):
    return PicklePOSSalesChannelType()

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