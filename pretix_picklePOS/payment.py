from django.utils.safestring import mark_safe
from django.utils.translation import gettext_lazy as _
from pretix.base.payment import BasePaymentProvider


class PayAtEntrance(BasePaymentProvider):
    identifier = "pay_at_entrance"

    @property
    def verbose_name(self):
        return _("Pay at Entrance (Reservation)")

    @property
    def settings_defaults(self):
        defaults = super().settings_defaults
        # Disable automatic payment reminders for this method by default
        defaults["send_mail_reminder"] = False
        return defaults

    @property
    def payment_form_field(self):
        # Optional: Custom form fields displayed on checkout if needed
        return super().payment_form_field

    def payment_is_valid_session(self, request):
        return True

    def order_pending_mail_render(self, order):
        # You can customize the email text sent to the user
        # instructing them to pay when they arrive at the venue.
        return ""

    def checkout_prepare(self, request, cart):
        # Return True to allow proceeding with this payment method
        return True

    def payment_control_render(self, request, payment):
        # HTML shown in the backend order details view
        # (e.g., showing a button to mark it paid via cash right from the order page)
        return '<span class="label label-warning">To be paid at entrance</span>'

    def checkout_confirm_render(self, request, order=None, info_data=None):
        # Text shown on the final checkout confirmation page
        return str(_("You will pay for your tickets when you arrive at the entrance."))

    def execute_payment(self, request, payment):
        # This is where a credit card plugin would redirect to a bank.
        # For a manual reservation, we simply return None.
        # Pretix will complete the order, leave the payment as pending,
        # and automatically redirect the user to their order success page.
        return None

    def payment_pending_render(self, request, order):
        # We output a hidden marker and our custom friendly message
        return mark_safe(
            '<div id="picklepos-pay-at-entrance-marker" class="hidden"></div>'
        )

    @property
    def is_implicit(self):
        return False
