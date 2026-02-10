from django.contrib import admin
from .models import Invoice

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('number', 'tenant', 'amount', 'date_issued', 'status')
    list_filter = ('status', 'tenant')
