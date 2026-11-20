from datetime import date

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Athlete, Club, Event, Transfer
from .services import validate_transfer_data
from .utils import calc_age, clean_data, fix_mojibake, normalize_choice

User = get_user_model()


class CleanTextMixin:
    """Clean legacy-encoded strings recursively without changing field names."""

    def to_representation(self, instance):
        return clean_data(super().to_representation(instance))


class LegacyChoiceField(serializers.ChoiceField):
    def to_internal_value(self, data):
        normalized = normalize_choice(data, self.choices.items())
        return super().to_internal_value(normalized)

    def to_representation(self, value):
        return fix_mojibake(super().to_representation(value))


class ClubNameField(serializers.PrimaryKeyRelatedField):
    def use_pk_only_optimization(self):
        return False

    def to_representation(self, value):
        return fix_mojibake(value.name) if value else None


class UserSerializer(CleanTextMixin, serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id", "username", "first_name", "last_name", "email", "title",
            "avatar", "avatar_url", "is_staff",
        )
        read_only_fields = ("id", "username", "avatar_url", "is_staff")
        extra_kwargs = {"avatar": {"write_only": True, "required": False}}

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_avatar_url(self, obj):
        request = self.context.get("request")
        return request.build_absolute_uri(obj.avatar.url) if request and obj.avatar else None


class RegisterSerializer(CleanTextMixin, serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ("id", "username", "first_name", "last_name", "email", "password", "password_confirm")
        read_only_fields = ("id",)

    def validate(self, data):
        if data["password"] != data["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": ["Пароли не совпадают."]})
        if not settings.REGISTRATION_ENABLED:
            raise serializers.ValidationError({"detail": ["Регистрация временно отключена."]})
        return data

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class ClubSerializer(CleanTextMixin, serializers.ModelSerializer):
    athlete_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Club
        fields = "__all__"


class AthleteSerializer(CleanTextMixin, serializers.ModelSerializer):
    name = serializers.CharField(read_only=True)
    full_name = serializers.CharField(read_only=True)
    age = serializers.SerializerMethodField()
    club = ClubNameField(queryset=Club.objects.all(), required=False, allow_null=True)
    club_name = serializers.CharField(source="club.name", read_only=True, default="Без клуба")
    club_color = serializers.CharField(source="club.color", read_only=True, default="#a0a9b7")
    club_id = serializers.IntegerField(read_only=True)
    medical = serializers.CharField(source="medical_notes", read_only=True)
    transfers = serializers.SerializerMethodField()
    status = LegacyChoiceField(choices=Athlete.STATUS_CHOICES, required=False)
    gender = LegacyChoiceField(choices=Athlete.GENDER_CHOICES, required=False)

    class Meta:
        model = Athlete
        fields = "__all__"

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_age(self, obj):
        return calc_age(obj.birth_date)

    def validate_birth_date(self, value):
        if value > date.today():
            raise serializers.ValidationError("Дата рождения не может быть в будущем.")
        return value

    def validate_height(self, value):
        if value is not None and not 120 <= value <= 240:
            raise serializers.ValidationError("Рост должен быть от 120 до 240 см.")
        return value

    def validate_weight(self, value):
        if value is not None and not 30 <= value <= 200:
            raise serializers.ValidationError("Вес должен быть от 30 до 200 кг.")
        return value

    def validate(self, attrs):
        club = attrs.get("club", getattr(self.instance, "club", None))
        number = attrs.get("number", getattr(self.instance, "number", None))
        if club and number:
            duplicate = Athlete.objects.filter(club=club, number=number)
            if self.instance:
                duplicate = duplicate.exclude(pk=self.instance.pk)
            if duplicate.exists():
                raise serializers.ValidationError({"number": ["Этот игровой номер уже занят в клубе."]})
        return attrs

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_transfers(self, obj):
        return TransferSerializer(
            obj.transfers.all(), many=True, context=self.context
        ).data


class TransferSerializer(CleanTextMixin, serializers.ModelSerializer):
    athlete_name = serializers.CharField(source="athlete.name", read_only=True)
    from_club_name = serializers.CharField(source="from_club.name", read_only=True, default="Свободный агент")
    to_club_name = serializers.CharField(source="to_club.name", read_only=True, default="Без клуба")
    type = serializers.CharField(source="note", read_only=True)
    status = LegacyChoiceField(choices=Transfer.STATUS_CHOICES, required=False)

    class Meta:
        model = Transfer
        fields = "__all__"

    def validate(self, attrs):
        if self.instance is not None:
            self._transfer_warnings = []
            return attrs
        errors, warnings = validate_transfer_data(attrs)
        self._transfer_warnings = warnings
        if errors:
            raise serializers.ValidationError({"errors": errors})
        return attrs


class EventSerializer(CleanTextMixin, serializers.ModelSerializer):
    clubs = serializers.PrimaryKeyRelatedField(many=True, queryset=Club.objects.all(), required=False)
    club_names = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = "__all__"

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_club_names(self, obj):
        return [fix_mojibake(club.name) for club in obj.clubs.all()]
