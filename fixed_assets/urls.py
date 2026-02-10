from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .viewsets import (
    FixedAssetCategoryViewSet,
    FixedAssetViewSet,
    DepreciationScheduleViewSet,
    FAReceiptDocumentViewSet,
    FAAcceptanceDocumentViewSet,
    FADisposalDocumentViewSet,
    IntangibleAssetCategoryViewSet,
    IntangibleAssetViewSet,
    AmortizationScheduleViewSet,
    IAReceiptDocumentViewSet,
    IAAcceptanceDocumentViewSet,
    IADisposalDocumentViewSet
)

router = DefaultRouter()

# Fixed Assets (OS)
router.register(r'categories', FixedAssetCategoryViewSet, basename='fa-category')
router.register(r'assets', FixedAssetViewSet, basename='fixed-asset')
router.register(r'depreciation', DepreciationScheduleViewSet, basename='depreciation-schedule')
router.register(r'receipts', FAReceiptDocumentViewSet, basename='fa-receipt')
router.register(r'acceptances', FAAcceptanceDocumentViewSet, basename='fa-acceptance')
router.register(r'disposals', FADisposalDocumentViewSet, basename='fa-disposal')

# Intangible Assets (NMA)
router.register(r'ia/categories', IntangibleAssetCategoryViewSet, basename='ia-category')
router.register(r'ia/assets', IntangibleAssetViewSet, basename='intangible-asset')
router.register(r'ia/amortization', AmortizationScheduleViewSet, basename='amortization-schedule')
router.register(r'ia/receipts', IAReceiptDocumentViewSet, basename='ia-receipt')
router.register(r'ia/acceptances', IAAcceptanceDocumentViewSet, basename='ia-acceptance')
router.register(r'ia/disposals', IADisposalDocumentViewSet, basename='ia-disposal')

urlpatterns = [
    path('', include(router.urls)),
]
