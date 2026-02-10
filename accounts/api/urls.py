"""
API URL configuration for accounts app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .viewsets import (
    UserViewSet,
    RoleViewSet,
    PermissionViewSet,
    TenantViewSet,
)
from .views import RegisterView, CurrentUserView

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'roles', RoleViewSet, basename='role')
router.register(r'permissions', PermissionViewSet, basename='permission')
router.register(r'tenant', TenantViewSet, basename='tenant')

urlpatterns = [
    path('', include(router.urls)),
]

# Auth endpoints - injected into /api/v1/auth/
auth_urlpatterns = [
    path('register/', RegisterView.as_view(), name='api_register'),
    path('me/', CurrentUserView.as_view(), name='api_current_user'),
]
