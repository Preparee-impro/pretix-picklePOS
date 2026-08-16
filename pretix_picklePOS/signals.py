# Register your receivers here
from django.dispatch import receiver
from django.urls import reverse, resolve
from django.utils.translation import gettext_lazy as _

from pretix.control.signals import nav_event


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