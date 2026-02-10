from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from .models import Currency, ExchangeRate, Counterparty, ContactPerson, Contract, Warehouse, Item

@admin.register(Currency)
class CurrencyAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'symbol')

@admin.register(ExchangeRate)
class ExchangeRateAdmin(admin.ModelAdmin):
    list_display = ('currency', 'date', 'rate', 'tenant')
    list_filter = ('tenant', 'currency')

class ContactPersonInline(admin.TabularInline):
    model = ContactPerson
    extra = 0

@admin.register(Counterparty)
class CounterpartyAdmin(admin.ModelAdmin):
    list_display = ('name', 'inn', 'type', 'tenant')
    list_filter = ('tenant', 'type')
    search_fields = ('name', 'inn')
    inlines = [ContactPersonInline]

@admin.register(ContactPerson)
class ContactPersonAdmin(admin.ModelAdmin):
    list_display = ('name', 'counterparty', 'position', 'email', 'phone', 'tenant')
    list_filter = ('tenant', 'counterparty')
    search_fields = ('name', 'email', 'phone')

@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = ('number', 'date', 'counterparty', 'contract_type', 'tenant')
    list_filter = ('tenant', 'contract_type')

@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ('name', 'address', 'is_active', 'tenant')
    list_filter = ('tenant', 'is_active')

@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'sku', 'item_type', 'purchase_price', 'selling_price', 'tenant')
    list_filter = ('tenant', 'item_type')
    search_fields = ('name', 'sku')
