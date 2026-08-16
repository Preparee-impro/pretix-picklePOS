from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _
from . import __version__

try:
    from pretix.base.plugins import PluginConfig
except ImportError:
    raise RuntimeError("Please use pretix 2.7 or above to run this plugin!")


class PluginApp(PluginConfig):
    default = True
    name = "pretix_picklePOS"
    verbose_name = "picklePOS"

    class PretixPluginMeta:
        name = _("picklePOS")
        author = "Douwe Somers"
        description = _("POS system for Pretix that allows quickly creating and modifying orders for front desk staff.")
        visible = True
        version = __version__
        category = "FEATURE"
        compatibility = "pretix>=2.7.0"
        settings_links = []
        navigation_links = []

    def ready(self):
        from . import signals  # NOQA
