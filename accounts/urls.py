from django.urls import path
from . import views

app_name = 'accounts'

urlpatterns = [
    # New RBAC-protected URLs
    path('users/', views.UserListView.as_view(), name='user_list'),
    path('users/invite/', views.UserInviteView.as_view(), name='user_invite'),
    path('users/<int:pk>/role/', views.UserRoleUpdateView.as_view(), name='user_role_update'),
    path('users/<int:pk>/activate/', views.UserActivateView.as_view(), name='user_activate'),
    path('users/<int:pk>/deactivate/', views.UserDeactivateView.as_view(), name='user_deactivate'),
    
    # Legacy URLs (backwards compatibility)
    path('team/', views.TeamListView.as_view(), name='team_list'),
    path('team/add/', views.TeamCreateView.as_view(), name='team_add'),
]

