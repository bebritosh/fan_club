from django.urls import include, path, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    AthleteViewSet,
    AuditView,
    CalendarICSView,
    ClubViewSet,
    EventViewSet,
    HealthView,
    NotificationsView,
    PasswordChangeView,
    ProfileView,
    QualityView,
    RegisterView,
    SearchView,
    TransferViewSet,
    analytics,
    dashboard,
)

router = DefaultRouter()
router.register("athletes", AthleteViewSet)
router.register("clubs", ClubViewSet)
router.register("transfers", TransferViewSet)
router.register("events", EventViewSet)

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="api-schema"), name="api-docs"),
    path("schema/", SpectacularAPIView.as_view(), name="api-schema"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", ProfileView.as_view(), name="profile"),
    path("auth/password/", PasswordChangeView.as_view(), name="password-change"),
    path("dashboard/", dashboard, name="dashboard"),
    path("analytics/", analytics, name="analytics"),
    path("search/", SearchView.as_view(), name="search"),
    path("notifications/", NotificationsView.as_view(), name="notifications"),
    path("quality/", QualityView.as_view(), name="quality"),
    path("audit/", AuditView.as_view(), name="audit"),
    re_path(r"^events/calendar\.ics/?$", CalendarICSView.as_view(), name="events-calendar-ics"),
    path("", include(router.urls)),
]
