from django.contrib import admin
from .models import Tenant, Role

@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ('company_name', 'inn', 'base_currency', 'default_language', 'is_active')
    search_fields = ('company_name', 'inn')

@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'tenant')
    list_filter = ('tenant', 'code')
