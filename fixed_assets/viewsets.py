"""
Fixed Assets API ViewSets
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from .models import (
    FixedAssetCategory,
    FixedAsset,
    DepreciationSchedule,
    FAReceiptDocument,
    FAAcceptanceDocument,
    FADisposalDocument,
    IntangibleAssetCategory,
    IntangibleAsset,
    AmortizationSchedule,
    IAReceiptDocument,
    IAAcceptanceDocument,
    IADisposalDocument
)
from .serializers import (
    FixedAssetCategorySerializer,
    FixedAssetListSerializer,
    FixedAssetDetailSerializer,
    DepreciationScheduleSerializer,
    FAReceiptDocumentSerializer,
    FAAcceptanceDocumentSerializer,
    FADisposalDocumentSerializer,
    IntangibleAssetCategorySerializer,
    IntangibleAssetSerializer,
    AmortizationScheduleSerializer,
    IAReceiptDocumentSerializer,
    IAAcceptanceDocumentSerializer,
    IADisposalDocumentSerializer
)

class InternalInconsistencyError(Exception):
    pass

class FixedAssetCategoryViewSet(viewsets.ModelViewSet):
    queryset = FixedAssetCategory.objects.all()
    serializer_class = FixedAssetCategorySerializer
    
    def get_queryset(self):
        return self.queryset.filter(tenant=self.request.user.tenant)
    
    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)


class FixedAssetViewSet(viewsets.ModelViewSet):
    queryset = FixedAsset.objects.all()
    
    def get_serializer_class(self):
        if self.action in ['list', 'retrieve']:
            if self.action == 'retrieve':
                return FixedAssetDetailSerializer
            return FixedAssetListSerializer
        return FixedAssetDetailSerializer  # Fallback
    
    def get_queryset(self):
        return self.queryset.filter(tenant=self.request.user.tenant)
    
    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)
    
    @action(detail=True, methods=['post'])
    def calculate_depreciation(self, request, pk=None):
        asset = self.get_object()
        amount = asset.calculate_monthly_depreciation()
        return Response({'monthly_amount': amount})


class DepreciationScheduleViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DepreciationSchedule.objects.all()
    serializer_class = DepreciationScheduleSerializer
    
    def get_queryset(self):
        return self.queryset.filter(tenant=self.request.user.tenant)


class FAReceiptDocumentViewSet(viewsets.ModelViewSet):
    queryset = FAReceiptDocument.objects.all()
    serializer_class = FAReceiptDocumentSerializer
    
    def get_queryset(self):
        return self.queryset.filter(tenant=self.request.user.tenant)
    
    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, created_by=self.request.user)
        
    @action(detail=True, methods=['post'])
    def post(self, request, pk=None):
        doc = self.get_object()
        try:
            doc.post()
            return Response({'status': 'posted'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class FAAcceptanceDocumentViewSet(viewsets.ModelViewSet):
    queryset = FAAcceptanceDocument.objects.all()
    serializer_class = FAAcceptanceDocumentSerializer
    
    def get_queryset(self):
        return self.queryset.filter(tenant=self.request.user.tenant)
    
    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, created_by=self.request.user)
        
    @action(detail=True, methods=['post'])
    def post(self, request, pk=None):
        doc = self.get_object()
        try:
            doc.post()
            return Response({'status': 'posted'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class FADisposalDocumentViewSet(viewsets.ModelViewSet):
    queryset = FADisposalDocument.objects.all()
    serializer_class = FADisposalDocumentSerializer
    
    def get_queryset(self):
        return self.queryset.filter(tenant=self.request.user.tenant)
    
    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, created_by=self.request.user)
        
    @action(detail=True, methods=['post'])
    def post(self, request, pk=None):
        doc = self.get_object()
        try:
            doc.post()
            return Response({'status': 'posted'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# --- INTANGIBLE ASSETS VIEWSETS ---

class IntangibleAssetCategoryViewSet(viewsets.ModelViewSet):
    queryset = IntangibleAssetCategory.objects.all()
    serializer_class = IntangibleAssetCategorySerializer
    
    def get_queryset(self):
        return self.queryset.filter(tenant=self.request.user.tenant)
    
    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)

class IntangibleAssetViewSet(viewsets.ModelViewSet):
    queryset = IntangibleAsset.objects.all()
    serializer_class = IntangibleAssetSerializer
    
    def get_queryset(self):
        return self.queryset.filter(tenant=self.request.user.tenant)
    
    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)

class AmortizationScheduleViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AmortizationSchedule.objects.all()
    serializer_class = AmortizationScheduleSerializer
    
    def get_queryset(self):
        return self.queryset.filter(tenant=self.request.user.tenant)

class IAReceiptDocumentViewSet(viewsets.ModelViewSet):
    queryset = IAReceiptDocument.objects.all()
    serializer_class = IAReceiptDocumentSerializer
    
    def get_queryset(self):
        return self.queryset.filter(tenant=self.request.user.tenant)
    
    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)
        
    @action(detail=True, methods=['post'])
    def post(self, request, pk=None):
        doc = self.get_object()
        try:
            doc.post()
            return Response({'status': 'posted'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class IAAcceptanceDocumentViewSet(viewsets.ModelViewSet):
    queryset = IAAcceptanceDocument.objects.all()
    serializer_class = IAAcceptanceDocumentSerializer
    
    def get_queryset(self):
        return self.queryset.filter(tenant=self.request.user.tenant)
    
    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)
        
    @action(detail=True, methods=['post'])
    def post(self, request, pk=None):
        doc = self.get_object()
        try:
            doc.post()
            return Response({'status': 'posted'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class IADisposalDocumentViewSet(viewsets.ModelViewSet):
    queryset = IADisposalDocument.objects.all()
    serializer_class = IADisposalDocumentSerializer
    
    def get_queryset(self):
        return self.queryset.filter(tenant=self.request.user.tenant)
    
    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)
        
    @action(detail=True, methods=['post'])
    def post(self, request, pk=None):
        doc = self.get_object()
        try:
            doc.post()
            return Response({'status': 'posted'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
