from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.users.views import UserGroupViewSet, UserViewSet

router = DefaultRouter()
router.register('groups', UserGroupViewSet, basename='user-group')
router.register('', UserViewSet, basename='user')

urlpatterns = [
    path('', include(router.urls)),
]

