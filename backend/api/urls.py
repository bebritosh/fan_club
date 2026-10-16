from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import AthleteViewSet, ClubViewSet, EventViewSet, PasswordChangeView, ProfileView, RegisterView, TransferViewSet, analytics, dashboard

router = DefaultRouter()
router.register("athletes", AthleteViewSet)
router.register("clubs", ClubViewSet)
router.register("transfers", TransferViewSet)
router.register("events", EventViewSet)
urlpatterns = [path("auth/register/", RegisterView.as_view()), path("auth/token/", TokenObtainPairView.as_view()), path("auth/token/refresh/", TokenRefreshView.as_view()), path("auth/me/", ProfileView.as_view()), path("auth/password/", PasswordChangeView.as_view()), path("dashboard/", dashboard), path("analytics/", analytics), path("", include(router.urls))]
