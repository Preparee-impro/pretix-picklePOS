from django.urls import re_path

from .views import frontdesk_view

urlpatterns = [
    re_path(
        r"^control/event/(?P<organizer>[^/]+)/(?P<event>[^/]+)/frontdesk/$",
        frontdesk_view,
        name="frontdesk",
    ),
]