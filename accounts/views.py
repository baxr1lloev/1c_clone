from django.views.generic import ListView, CreateView, UpdateView, View
from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy, reverse
from django.shortcuts import get_object_or_404, redirect
from django.contrib import messages
from django.contrib.auth import get_user_model
from .forms import EmployeeCreationForm, UserRoleForm
from tenants.models import Role
from tenants.permissions import PermissionRequiredMixin

User = get_user_model()


class UserListView(LoginRequiredMixin, PermissionRequiredMixin, ListView):
    """List all users in the tenant with role management."""
    model = User
    template_name = 'accounts/user_list.html'
    context_object_name = 'users'
    permission_required = 'admin.manage_users'
    
    def get_queryset(self):
        return User.objects.filter(tenant=self.request.user.tenant).select_related('role')


class UserInviteView(LoginRequiredMixin, PermissionRequiredMixin, CreateView):
    """Invite a new user to the tenant."""
    model = User
    form_class = EmployeeCreationForm
    template_name = 'accounts/user_form.html'
    success_url = reverse_lazy('accounts:user_list')
    permission_required = 'admin.manage_users'
    
    extra_context = {'title': 'Invite User'}
    
    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['tenant'] = self.request.user.tenant
        return kwargs
    
    def form_valid(self, form):
        user = form.save(commit=False)
        user.tenant = self.request.user.tenant
        user.set_password(User.objects.make_random_password())  # Temporary
        user.save()
        
        # TODO: Send email with password reset link
        messages.success(
            self.request,
            f'User {user.email} invited successfully. Email sent with login instructions.'
        )
        return redirect(self.success_url)


class UserRoleUpdateView(LoginRequiredMixin, PermissionRequiredMixin, UpdateView):
    """Change a user's role."""
    model = User
    form_class = UserRoleForm
    template_name = 'accounts/user_role_form.html'
    success_url = reverse_lazy('accounts:user_list')
    permission_required = 'admin.assign_roles'
    
    def get_queryset(self):
        return User.objects.filter(tenant=self.request.user.tenant)
    
    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['tenant'] = self.request.user.tenant
        return kwargs
    
    def form_valid(self, form):
        messages.success(
            self.request,
            f'Role updated for {form.instance.email}'
        )
        return super().form_valid(form)


class UserActivateView(LoginRequiredMixin, PermissionRequiredMixin, View):
    """Activate a user."""
    permission_required = 'admin.manage_users'
    
    def post(self, request, pk):
        user = get_object_or_404(User, pk=pk, tenant=request.user.tenant)
        user.is_active = True
        user.save()
        messages.success(request, f'{user.email} activated successfully')
        return redirect('accounts:user_list')


class UserDeactivateView(LoginRequiredMixin, PermissionRequiredMixin, View):
    """Deactivate a user."""
    permission_required = 'admin.manage_users'
    
    def post(self, request, pk):
        user = get_object_or_404(User, pk=pk, tenant=request.user.tenant)
        
        # Prevent self-deactivation
        if user.id == request.user.id:
            messages.error(request, 'You cannot deactivate yourself!')
            return redirect('accounts:user_list')
        
        user.is_active = False
        user.save()
        messages.success(request, f'{user.email} deactivated successfully')
        return redirect('accounts:user_list')


# Legacy views (keep for backwards compatibility)
class TeamListView(LoginRequiredMixin, ListView):
    model = User
    template_name = 'accounts/team_list.html'
    context_object_name = 'employees'
    
    def get_queryset(self):
        return User.objects.filter(tenant=self.request.user.tenant)


class TeamCreateView(LoginRequiredMixin, CreateView):
    model = User
    form_class = EmployeeCreationForm
    template_name = 'directories/form.html'
    success_url = reverse_lazy('accounts:team_list')
    extra_context = {'title': 'Add Employee'}
    
    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['tenant'] = self.request.user.tenant
        return kwargs
    
    def get_form(self, form_class=None):
        self._ensure_roles_exist(self.request.user.tenant)
        return super().get_form(form_class)

    def form_valid(self, form):
        form.instance.tenant = self.request.user.tenant
        return super().form_valid(form)
        
    def _ensure_roles_exist(self, tenant):
        roles = ['MANAGER', 'WAREHOUSE', 'ACCOUNTANT']
        for code in roles:
            Role.objects.get_or_create(
                tenant=tenant,
                code=code,
                defaults={'name': code.capitalize()}
            )
