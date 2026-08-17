from django.urls import path

from . import views

urlpatterns = [
    # Frontdesk view
    path(
        "control/event/<str:organizer>/<str:event>/picklepos/",
        views.POSDashboardView.as_view(),
        name="pos_dashboard",
    ),
    # Checkout view
    path(
        "control/event/<str:organizer>/<str:event>/picklepos/checkout/",
        views.POSCheckoutView.as_view(),
        name="pos_checkout",
    ),
    # Order search
    path(
        "control/event/<str:organizer>/<str:event>/picklepos/search/",
        views.POSSearchView.as_view(),
        name="pos_search",
    ),
    # Load order
    path(
        "control/event/<str:organizer>/<str:event>/picklepos/load/",
        views.POSLoadOrderView.as_view(),
        name="pos_load_order",
    ),
    # Cancel order
    path(
        "control/event/<str:organizer>/<str:event>/picklepos/cancel/",
        views.POSCancelOrderView.as_view(),
        name="pos_cancel_order",
    ),
]
