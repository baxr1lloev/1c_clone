"""
API Serializers for accounts app.
"""
from rest_framework import serializers
from accounts.models import User
from tenants.models import Tenant, Role, Permission


class RoleSerializer(serializers.ModelSerializer):
    """Serializer for Role model."""
    code_display = serializers.CharField(source='get_code_display', read_only=True)
    
    class Meta:
        model = Role
        fields = ['id', 'name', 'code', 'code_display']


class PermissionSerializer(serializers.ModelSerializer):
    """Serializer for Permission model."""
    class Meta:
        model = Permission
        fields = ['id', 'code', 'name', 'description']


class UserListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for user list."""
    role_name = serializers.CharField(source='role.name', read_only=True, allow_null=True)
    
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'role_name', 'is_active']


class UserDetailSerializer(serializers.ModelSerializer):
    """Full serializer for user detail."""
    role = RoleSerializer(read_only=True)
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'role', 'is_active', 'is_staff'
        ]


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating users."""
    password = serializers.CharField(write_only=True, min_length=8)
    
    class Meta:
        model = User
        fields = ['email', 'first_name', 'last_name', 'password', 'role']
    
    def create(self, validated_data):
        password = validated_data.pop('password')
        validated_data['tenant'] = self.context['request'].user.tenant
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating users."""
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'role', 'is_active']


class TenantSerializer(serializers.ModelSerializer):
    """Serializer for Tenant model."""
    base_currency_code = serializers.CharField(source='base_currency.code', read_only=True, allow_null=True)
    
    class Meta:
        model = Tenant
        fields = [
            'id', 'company_name', 'inn', 'base_currency', 'base_currency_code',
            'default_language', 'is_active', 'created_at'
        ]
        read_only_fields = ['created_at']


class RegisterSerializer(serializers.Serializer):
    """Serializer for user registration."""
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    first_name = serializers.CharField(min_length=2)
    last_name = serializers.CharField(min_length=2)
    company_name = serializers.CharField(min_length=2)
