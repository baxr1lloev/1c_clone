from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from .models import Subscription
from billing.models import Invoice
from plans.models import SubscriptionPlan

class MySubscriptionView(LoginRequiredMixin, TemplateView):
    template_name = 'subscriptions/my_subscription.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        tenant = self.request.user.tenant
        
        # Ensure we have a plan to fallback on
        default_plan = SubscriptionPlan.objects.first()
        if not default_plan:
             default_plan = SubscriptionPlan.objects.create(
                 name='Free Trial',
                 price_monthly=0,
                 max_users=5,
                 max_storage_gb=10
             )

        # Get or create dummy subscription if none exists (for demo)
        sub, created = Subscription.objects.get_or_create(
            tenant=tenant,
            defaults={
                'plan': default_plan,
                'start_date': '2026-01-01',
                'end_date': '2026-12-31',
            }
        )
        
        context['subscription'] = sub
        context['invoices'] = Invoice.objects.filter(tenant=tenant)
        return context
