from django.urls import path
from . import views

urlpatterns = [
    # Frontdesk view
    path(
        'control/event/<str:organizer>/<str:event>/frontdesk/',
        views.POSDashboardView.as_view(),
        name="frontdesk",
    ),
    # Checkout view
    path(
        'control/event/<str:organizer>/<str:event>/frontdesk/checkout/', 
        views.POSCheckoutView.as_view(), 
        name='pos_checkout'
    ),
]