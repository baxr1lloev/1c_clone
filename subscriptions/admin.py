from django.contrib import admin
from .models import Subscription

@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('tenant', 'plan', 'start_date', 'end_date', 'is_active')
    list_filter = ('is_active', 'plan')
