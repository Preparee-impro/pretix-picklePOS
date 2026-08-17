all: localecompile
LNGS:=`find pretix_picklePOS/locale/ -mindepth 1 -maxdepth 1 -type d -printf "-l %f "`

localecompile:
	django-admin compilemessages

localegen:
	# 1. Extract Python and HTML strings (creates django.po)
	django-admin makemessages --add-location file --keep-pot -i build -i dist -i "*egg*" $(LNGS)
	# 2. Extract JavaScript strings (creates djangojs.po)
	django-admin makemessages -d djangojs --add-location file --keep-pot -i build -i dist -i "*egg*" -e js $(LNGS)

checkcode:
	black --check .
	isort -c .
	flake8 .

fixcode:
	isort .
	black .

.PHONY: all localecompile localegen
