"""
Fixed Assets API Serializers
"""

from rest_framework import serializers
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


class FixedAssetCategorySerializer(serializers.ModelSerializer):
    """Serializer for Fixed Asset Categories"""
    parent_name = serializers.CharField(source='parent.name', read_only=True, allow_null=True)
    
    class Meta:
        model = FixedAssetCategory
        fields = [
            'id', 'code', 'name', 'parent', 'parent_name',
            'default_useful_life_months', 'default_depreciation_method',
            'asset_account', 'depreciation_account'
        ]
        read_only_fields = []


class FixedAssetListSerializer(serializers.ModelSerializer):
    """List serializer for Fixed Assets"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    location_name = serializers.CharField(source='location.name', read_only=True, allow_null=True)
    current_value = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    
    class Meta:
        model = FixedAsset
        fields = [
            'id', 'inventory_number', 'name', 'category', 'category_name',
            'initial_cost', 'accumulated_depreciation', 'current_value',
            'status', 'location', 'location_name', 'commissioning_date'
        ]
        read_only_fields = ['accumulated_depreciation', 'current_value']


class FixedAssetDetailSerializer(serializers.ModelSerializer):
    """Detail serializer for Fixed Assets"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    location_name = serializers.CharField(source='location.name', read_only=True, allow_null=True)
    responsible_person_name = serializers.CharField(source='responsible_person.full_name', read_only=True, allow_null=True)
    current_value = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    depreciation_base = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    
    class Meta:
        model = FixedAsset
        fields = [
            'id', 'inventory_number', 'name', 'category', 'category_name',
            'initial_cost', 'residual_value', 'accumulated_depreciation',
            'current_value', 'depreciation_base',
            'depreciation_method', 'useful_life_months', 'depreciation_rate',
            'acquisition_date', 'commissioning_date', 'disposal_date',
            'location', 'location_name',
            'responsible_person', 'responsible_person_name',
            'status', 'description', 'serial_number', 'manufacturer'
        ]
        read_only_fields = ['accumulated_depreciation', 'current_value', 'depreciation_base']


class DepreciationScheduleSerializer(serializers.ModelSerializer):
    """Serializer for Depreciation Schedule"""
    asset_name = serializers.CharField(source='asset.name', read_only=True)
    asset_inventory_number = serializers.CharField(source='asset.inventory_number', read_only=True)
    
    class Meta:
        model = DepreciationSchedule
        fields = [
            'id', 'asset', 'asset_name', 'asset_inventory_number',
            'period', 'amount', 'accounting_entry', 'posted_at'
        ]
        read_only_fields = ['posted_at']


class FAReceiptDocumentSerializer(serializers.ModelSerializer):
    """Serializer for FA Receipt Documents"""
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    asset_name = serializers.CharField(source='asset.name', read_only=True, allow_null=True)
    
    class Meta:
        model = FAReceiptDocument
        fields = [
            'id', 'number', 'date', 'status',
            'supplier', 'supplier_name',
            'asset', 'asset_name',
            'posted_at', 'posted_by'
        ]
        read_only_fields = ['status', 'posted_at', 'posted_by']


class FAAcceptanceDocumentSerializer(serializers.ModelSerializer):
    """Serializer for FA Acceptance Documents"""
    asset_name = serializers.CharField(source='asset.name', read_only=True)
    
    class Meta:
        model = FAAcceptanceDocument
        fields = [
            'id', 'number', 'date', 'status',
            'asset', 'asset_name',
            'posted_at', 'posted_by'
        ]
        read_only_fields = ['status', 'posted_at', 'posted_by']


class FADisposalDocumentSerializer(serializers.ModelSerializer):
    """Serializer for FA Disposal Documents"""
    asset_name = serializers.CharField(source='asset.name', read_only=True)
    
    class Meta:
        model = FADisposalDocument
        fields = [
            'id', 'number', 'date', 'status',
            'asset', 'asset_name',
            'reason', 'sale_amount',
            'posted_at', 'posted_by'
        ]
        read_only_fields = ['status', 'posted_at', 'posted_by']


# --- INTANGIBLE ASSETS SERIALIZERS ---

class IntangibleAssetCategorySerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent.name', read_only=True, allow_null=True)
    class Meta:
        model = IntangibleAssetCategory
        fields = '__all__'

class IntangibleAssetSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    current_value = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    
    class Meta:
        model = IntangibleAsset
        fields = [
            'id', 'inventory_number', 'name', 'category', 'category_name',
            'initial_cost', 'accumulated_amortization', 'current_value',
            'useful_life_months', 'acquisition_date', 'commissioning_date',
            'write_off_date', 'status', 'description'
        ]
        read_only_fields = ['accumulated_amortization', 'current_value']

class AmortizationScheduleSerializer(serializers.ModelSerializer):
    asset_name = serializers.CharField(source='asset.name', read_only=True)
    class Meta:
        model = AmortizationSchedule
        fields = '__all__'

class IAReceiptDocumentSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    asset_name = serializers.CharField(source='asset.name', read_only=True)
    class Meta:
        model = IAReceiptDocument
        fields = '__all__'
        read_only_fields = ['status', 'posted_at', 'posted_by']

class IAAcceptanceDocumentSerializer(serializers.ModelSerializer):
    asset_name = serializers.CharField(source='asset.name', read_only=True)
    class Meta:
        model = IAAcceptanceDocument
        fields = '__all__'
        read_only_fields = ['status', 'posted_at', 'posted_by']

class IADisposalDocumentSerializer(serializers.ModelSerializer):
    asset_name = serializers.CharField(source='asset.name', read_only=True)
    class Meta:
        model = IADisposalDocument
        fields = '__all__'
        read_only_fields = ['status', 'posted_at', 'posted_by']
