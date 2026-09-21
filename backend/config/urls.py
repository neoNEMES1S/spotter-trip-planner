from django.urls import path
from planner import views

urlpatterns = [
    path("api/health", views.health),
    path("api/config", views.config),
    path("api/locations", views.locations),
    path("api/trips/plan", views.plan),
    path("", views.index),
]
