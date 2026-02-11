
import sys
import traceback

print("STARTING DEBUG SCRIPT")

try:
    import os
    import django
    
    # Setup Django environment
    print("Setting up Django...")
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    django.setup()
    print("Django setup complete.")

    from rest_framework.test import APIRequestFactory, force_authenticate
    from rest_framework.request import Request
    from documents.api.viewsets import PurchaseDocumentViewSet
    from accounts.models import User

    print("Imports complete. Finding user...")
    user = User.objects.filter(is_superuser=True).first() or User.objects.first()
    if not user:
        print("No user found!")
        sys.exit(1)
    
    print(f"Simulating request for user: {user.email} (Tenant: {user.tenant})")
    
    factory = APIRequestFactory()
    request = factory.get('/api/v1/documents/purchases/')
    force_authenticate(request, user=user)
    
    # Wrap in DRF Request
    drf_request = Request(request)
    
    # Instantiate viewset
    print("Instantiating ViewSet...")
    view = PurchaseDocumentViewSet.as_view({'get': 'list'})
    
    # Call view
    print("Calling View...")
    response = view(request)
    
    print(f"Response Status Code: {response.status_code}")
    if response.status_code == 200:
        print("Response Data (Summary):")
        if hasattr(response, 'data'):
            data = response.data
            # Pagination result
            if 'results' in data:
                print(f"Count: {data['count']}")
                print(f"Results: {len(data['results'])}")
                if len(data['results']) > 0:
                    print(f"First Item: {data['results'][0]['id']} - {data['results'][0]['number']}")
            else:
                print("No results key in data.")
    else:
        print("Response Error:")
        print(response.data)

except Exception:
    print("AN ERROR OCCURRED:")
    traceback.print_exc(file=sys.stdout)
