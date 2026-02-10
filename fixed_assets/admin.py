"""
Fixed Assets Admin Configuration
"""

from django.contrib import admin
from .models import (
    FixedAssetCategory,
    FixedAsset,
    DepreciationSchedule,
    FAReceiptDocument,
    FAAcceptanceDocument,
    FADisposalDocument
)


@admin.register(FixedAssetCategory)
class FixedAssetCategoryAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'parent', 'default_useful_life_months', 'default_depreciation_method']
    list_filter = ['default_depreciation_method']
    search_fields = ['code', 'name']
    ordering = ['code']


@admin.register(FixedAsset)
class FixedAssetAdmin(admin.ModelAdmin):
    list_display = ['inventory_number', 'name', 'category', 'initial_cost', 'accumulated_depreciation', 'current_value', 'status', 'commissioning_date']
    list_filter = ['status', 'category', 'depreciation_method']
    search_fields = ['inventory_number', 'name', 'serial_number']
    ordering = ['inventory_number']
    readonly_fields = ['accumulated_depreciation', 'current_value', 'depreciation_base']
    
    fieldsets = (
        ('Identification', {
            'fields': ('inventory_number', 'name', 'category', 'description')
        }),
        ('Financial', {
            'fields': ('initial_cost', 'residual_value', 'accumulated_depreciation', 'current_value', 'depreciation_base')
        }),
        ('Depreciation', {
            'fields': ('depreciation_method', 'useful_life_months', 'depreciation_rate')
        }),
        ('Dates', {
            'fields': ('acquisition_date', 'commissioning_date', 'disposal_date')
        }),
        ('Location & Responsibility', {
            'fields': ('location', 'responsible_person')
        }),
        ('Status & Details', {
            'fields': ('status', 'serial_number', 'manufacturer')
        }),
    )


@admin.register(DepreciationSchedule)
class DepreciationScheduleAdmin(admin.ModelAdmin):
    list_display = ['asset', 'period', 'amount', 'posted_at']
    list_filter = ['period']
    search_fields = ['asset__inventory_number', 'asset__name']
    ordering = ['-period']
    readonly_fields = ['posted_at']


@admin.register(FAReceiptDocument)
class FAReceiptDocumentAdmin(admin.ModelAdmin):
    list_display = ['number', 'date', 'supplier', 'asset', 'status', 'posted_at']
    list_filter = ['status', 'date']
    search_fields = ['number']
    ordering = ['-date', '-number']
    readonly_fields = ['status', 'posted_at', 'posted_by']


@admin.register(FAAcceptanceDocument)
class FAAcceptanceDocumentAdmin(admin.ModelAdmin):
    list_display = ['number', 'date', 'asset', 'status', 'posted_at']
    list_filter = ['status', 'date']
    search_fields = ['number']
    ordering = ['-date', '-number']
    readonly_fields = ['status', 'posted_at', 'posted_by']


@admin.register(FADisposalDocument)
class FADisposalDocumentAdmin(admin.ModelAdmin):
    list_display = ['number', 'date', 'asset', 'reason', 'sale_amount', 'status', 'posted_at']
    list_filter = ['status', 'reason', 'date']
    search_fields = ['number']
    ordering = ['-date', '-number']
    readonly_fields = ['status', 'posted_at', 'posted_by']
