
import os
import django
import sys
import json

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from documents.models import PurchaseDocument
from documents.api.serializers import PurchaseDocumentListSerializer, PurchaseDocumentDetailSerializer

try:
    doc = PurchaseDocument.objects.first()
    if not doc:
        print("No PurchaseDocument found in DB.")
    else:
        print(f"Found PurchaseDocument ID: {doc.id}")
        
        print("Testing List Serializer...")
        try:
            list_serializer = PurchaseDocumentListSerializer(doc)
            # data access triggers the serialization
            data = list_serializer.data
            print("List Serializer: SUCCESS")
        except Exception as e:
            print(f"List Serializer Error: {e}")
            
except Exception as e:
    print(f"General Error: {e}")
