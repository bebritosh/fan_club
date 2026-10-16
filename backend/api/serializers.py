from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import Athlete, Club, Event, Transfer

User = get_user_model()

class ClubNameField(serializers.PrimaryKeyRelatedField):
    def use_pk_only_optimization(self): return False
    def to_representation(self, value): return value.name if value else None

class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    class Meta:
        model = User
        fields = ("id", "username", "first_name", "last_name", "email", "title", "avatar", "avatar_url")
        read_only_fields = ("id", "username", "avatar_url")
        extra_kwargs = {"avatar": {"write_only": True, "required": False}}
    def get_avatar_url(self, obj):
        request = self.context.get("request")
        return request.build_absolute_uri(obj.avatar.url) if request and obj.avatar else None

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    class Meta:
        model = User
        fields = ("id", "username", "first_name", "last_name", "email", "password", "password_confirm")
        read_only_fields = ("id",)
    def validate(self, data):
        if data["password"] != data["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Пароли не совпадают."})
        return data
    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)

class ClubSerializer(serializers.ModelSerializer):
    athlete_count = serializers.IntegerField(read_only=True)
    class Meta:
        model = Club
        fields = "__all__"

class AthleteSerializer(serializers.ModelSerializer):
    name = serializers.CharField(read_only=True)
    full_name = serializers.CharField(read_only=True)
    age = serializers.IntegerField(read_only=True)
    club = ClubNameField(queryset=Club.objects.all(), required=False, allow_null=True)
    club_name = serializers.CharField(source="club.name", read_only=True, default="Без клуба")
    club_color = serializers.CharField(source="club.color", read_only=True, default="#a0a9b7")
    club_id = serializers.IntegerField(read_only=True)
    medical = serializers.CharField(source="medical_notes", read_only=True)
    transfers = serializers.SerializerMethodField()
    class Meta:
        model = Athlete
        fields = "__all__"
    def get_transfers(self, obj):
        return TransferSerializer(obj.transfers.all(), many=True, context=self.context).data

class TransferSerializer(serializers.ModelSerializer):
    athlete_name = serializers.CharField(source="athlete.name", read_only=True)
    from_club_name = serializers.CharField(source="from_club.name", read_only=True, default="Свободный агент")
    to_club_name = serializers.CharField(source="to_club.name", read_only=True, default="Без клуба")
    type = serializers.CharField(source="note", read_only=True)
    class Meta:
        model = Transfer
        fields = "__all__"

class EventSerializer(serializers.ModelSerializer):
    clubs = serializers.PrimaryKeyRelatedField(many=True, queryset=Club.objects.all(), required=False)
    club_names = serializers.SerializerMethodField()
    class Meta:
        model = Event
        fields = "__all__"
    def get_club_names(self, obj): return list(obj.clubs.values_list("name", flat=True))
