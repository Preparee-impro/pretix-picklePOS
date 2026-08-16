from django.urls import re_path
from . import views

urlpatterns = [
    re_path(
        r"^control/event/(?P<organizer>[^/]+)/(?P<event>[^/]+)/frontdesk/$",
        views.POSDashboardView.as_view(),
        name="frontdesk",
    ),
]