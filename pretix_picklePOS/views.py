from django.shortcuts import render
from pretix.control.permissions import event_permission_required


@event_permission_required('event.orders:read')
def frontdesk_view(request, organizer, event):
    return render(request, "pretix_picklePOS/frontdesk.html", {})