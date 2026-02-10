from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from .models import TaxScheme, TaxForm, TaxField, TaxReport, TaxReportLine

class TaxFieldInline(admin.TabularInline):
    model = TaxField
    extra = 1
    fields = ['code', 'label', 'source_type', 'formula', 'is_required', 'order']

@admin.register(TaxScheme)
class TaxSchemeAdmin(admin.ModelAdmin):
    list_display = ('country', 'name', 'version', 'is_active', 'created_at')
    list_filter = ('country', 'is_active')
    search_fields = ('name', 'description')

@admin.register(TaxForm)
class TaxFormAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'scheme', 'period_type')
    list_filter = ('scheme', 'period_type')
    search_fields = ('code', 'name')
    inlines = [TaxFieldInline]

class TaxReportLineInline(admin.TabularInline):
    model = TaxReportLine
    extra = 0
    fields = ['field', 'value_numeric', 'value_text', 'is_manual_override']
    readonly_fields = ['field']

@admin.register(TaxReport)
class TaxReportAdmin(admin.ModelAdmin):
    list_display = ('tenant', 'form', 'period_start', 'period_end', 'status', 'created_at')
    list_filter = ('status', 'form__scheme__country', 'form')
    search_fields = ('tenant__name',)
    readonly_fields = ('created_at', 'updated_at')
    inlines = [TaxReportLineInline]
