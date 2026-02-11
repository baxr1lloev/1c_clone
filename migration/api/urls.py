# migration/api/urls.py
"""URL routing for migration API endpoints"""

from django.urls import path
from . import import_views

urlpatterns = [
    path('import/', import_views.import_from_1c, name='import-from-1c'),
    path('validate-import/', import_views.validate_import, name='validate-import'),
    path('import-status/', import_views.import_status, name='import-status'),
]
