
import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from documents.models import SalesDocument

print(f"Sales Documents Count: {SalesDocument.objects.count()}")
docs = SalesDocument.objects.all().order_by('id')[:5]
for d in docs:
    print(f"ID: {d.id} Number: {d.number}")
