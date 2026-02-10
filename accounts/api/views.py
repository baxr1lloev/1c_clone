"""
Authentication API views for registration and user profile.
"""
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.db import transaction

from accounts.models import User
from tenants.models import Tenant, Role
from .serializers import (
    RegisterSerializer,
    UserDetailSerializer,
)


class RegisterView(APIView):
    """
    Register a new user and create their tenant (company).
    Returns JWT tokens on success.
    """
    permission_classes = [AllowAny]
    
    @transaction.atomic
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        
        # Check if email already exists
        if User.objects.filter(email=data['email']).exists():
            return Response(
                {'email': ['A user with this email already exists.']},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create tenant (company)
        tenant = Tenant.objects.create(
            company_name=data['company_name'],
        )
        
        # Create admin role for this tenant
        admin_role = Role.objects.create(
            tenant=tenant,
            name='Administrator',
            code='admin',
        )
        
        # Create user
        user = User.objects.create_user(
            email=data['email'],
            password=data['password'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            tenant=tenant,
            role=admin_role,
            is_staff=False,
        )
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
            }
        }, status=status.HTTP_201_CREATED)


class CurrentUserView(APIView):
    """
    Get the current authenticated user's profile.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        serializer = UserDetailSerializer(request.user)
        return Response(serializer.data)
