from django.urls import path
from . import views

app_name = 'subscriptions'

urlpatterns = [
    path('my-plan/', views.MySubscriptionView.as_view(), name='my_plan'),
]
