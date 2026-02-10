"""
API ViewSets for accounts app.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from accounts.models import User
from tenants.models import Role, Permission

from .serializers import (
    UserListSerializer,
    UserDetailSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    RoleSerializer,
    PermissionSerializer,
    TenantSerializer,
)


class UserViewSet(viewsets.ModelViewSet):
    """API endpoint for users within the current tenant."""
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return User.objects.filter(tenant=self.request.user.tenant).select_related('role')
    
    def get_serializer_class(self):
        if self.action == 'list':
            return UserListSerializer
        elif self.action == 'create':
            return UserCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserDetailSerializer
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user profile."""
        serializer = UserDetailSerializer(request.user)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a user."""
        user = self.get_object()
        user.is_active = True
        user.save()
        return Response({'status': 'activated'})
    
    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate a user."""
        user = self.get_object()
        if user == request.user:
            return Response(
                {'error': 'Cannot deactivate yourself'},
                status=status.HTTP_400_BAD_REQUEST
            )
        user.is_active = False
        user.save()
        return Response({'status': 'deactivated'})


class RoleViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint for roles within the current tenant."""
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Role.objects.filter(tenant=self.request.user.tenant)


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint for permissions (global, read-only)."""
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated]


class TenantViewSet(viewsets.GenericViewSet):
    """API endpoint for current tenant info."""
    serializer_class = TenantSerializer
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get current tenant info."""
        tenant = request.user.tenant
        if not tenant:
            return Response({'error': 'No tenant associated'}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(tenant)
        return Response(serializer.data)
