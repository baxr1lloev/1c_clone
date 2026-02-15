from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from core.views import DashboardView, MonthlyReportView, custom_logout
from core.api_views import DashboardStatsView, DashboardRevenueChartView
from django.contrib.auth.views import LoginView, LogoutView
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from accounts.api.views import RegisterView, CurrentUserView
from accounting.api_views import period_status as accounting_period_status


def health_check(request):
    return JsonResponse({"status": "ok"})


def api_root(request):
    return JsonResponse({
        "status": "ok",
        "service": "1C Clone Backend API",
        "api": "/api/v1/",
        "admin": "/admin/",
        "health": "/api/v1/health/",
        "docs": "/api/v1/",
    })


urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Root URL — show API info instead of crashing legacy dashboard
    path('', api_root, name='api_root'),

    # Legacy template views (keep for now)
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('reports/monthly/', MonthlyReportView.as_view(), name='monthly_report'),
    path('login/', LoginView.as_view(template_name='login.html'), name='login'),
    path('logout/', custom_logout, name='logout'),
    path('directories/', include('directories.urls')),
    path('documents/', include('documents.urls')),
    path('subscription/', include('subscriptions.urls')),
    path('billing/', include('billing.urls')),
    path('accounts/', include('accounts.urls')),
    path('accounting/', include('accounting.urls')),
    path('registers/', include('registers.urls')),
    path('taxes/', include('taxes.urls')),
    path('reports/', include('reports.urls')),  # Cash Flow reports
    path('i18n/', include('django.conf.urls.i18n')),
    
    # ─────────────────────────────────────────────────────────────────────
    # REST API v1 - For Next.js Frontend
    # ─────────────────────────────────────────────────────────────────────
    path('api/v1/', include([
        # Health check (used by Koyeb)
        path('health/', health_check, name='health_check'),

        # Authentication
        path('auth/token/', TokenObtainPairView.as_view(), name='api_token_obtain'),
        path('auth/token/refresh/', TokenRefreshView.as_view(), name='api_token_refresh'),
        path('auth/register/', RegisterView.as_view(), name='api_register'),
        path('auth/me/', CurrentUserView.as_view(), name='api_current_user'),
        
        # Dashboard
        path('dashboard/stats/', DashboardStatsView.as_view(), name='api_dashboard_stats'),
        path('dashboard/revenue-chart/', DashboardRevenueChartView.as_view(), name='api_dashboard_chart'),
        
        # Core APIs
        path('directories/', include('directories.api.urls')),
        path('documents/', include('documents.api.urls')),
        path('accounts/', include('accounts.api.urls')),
        path('registers/', include('registers.api.urls')),
        path('fixed-assets/', include('fixed_assets.urls')),  # Fixed Assets module
        path('migration/', include('migration.api.urls')),  # NEW: 1C Migration/Import
        
        # Admin / Audit
        path('admin/', include('audit_log.urls')),
        
        # VAT & accounting (period closing, operations, period status)
        path('vat/', include('accounting.api.urls')),
        path('accounting/period-status/', accounting_period_status),
        
        # Reports API (consolidated)
        path('reports/', include('reports.api.urls')),
    ])),
    
    # Legacy API endpoints (keep for backwards compatibility)
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/vat/', include('accounting.api.urls')),
]

