
import os
import django
import sys

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from documents.models import PurchaseDocument

try:
    count = PurchaseDocument.objects.count()
    print(f"Total Purchase Documents (raw): {count}")
    
    docs = PurchaseDocument.objects.all().order_by('id')[:5]
    for doc in docs:
        print(f"ID: {doc.id}, Number: {doc.number}, Contract ID: {doc.contract_id}")

    print("\nTesting ViewSet Queryset (select_related)...")
    try:
        qs = PurchaseDocument.objects.select_related(
            'counterparty', 'contract', 'warehouse', 'currency'
        ).all()
        print(f"Total Visible in ViewSet: {qs.count()}")
    except Exception as e:
        print(f"ViewSet Query Error: {e}")
        
except Exception as e:
    print(f"Error querying PurchaseDocuments: {e}")
