from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from .models import User

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'first_name', 'last_name', 'tenant', 'role', 'is_active', 'is_staff')
    list_filter = ('tenant', 'role', 'is_active', 'is_staff')
    search_fields = ('email', 'first_name', 'last_name')
