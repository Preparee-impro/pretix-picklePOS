from django.utils.translation import gettext_lazy as _
from pretix.base.channels import SalesChannelType


class PicklePOSSalesChannelType(SalesChannelType):
    identifier = "picklePOS"
    verbose_name = _("picklePOS Frontdesk")
    icon = "ticket"
    limited_by_default = False
    allow_multiple = False
