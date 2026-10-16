from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    title = models.CharField(max_length=120, blank=True, default="Менеджер системы")
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)

    def __str__(self):
        return self.get_full_name() or self.username

class Club(models.Model):
    name = models.CharField(max_length=160, unique=True)
    short_name = models.CharField(max_length=12)
    founded = models.PositiveSmallIntegerField()
    league = models.CharField(max_length=100)
    coach = models.CharField(max_length=120)
    color = models.CharField(max_length=7, default="#315fd2")
    logo = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)
    class Meta:
        ordering = ["name"]
    def __str__(self): return self.name

class Athlete(models.Model):
    STATUS_CHOICES = [(s, s) for s in ("Активен", "Травма", "Дисквалификация", "Завершил карьеру")]
    GENDER_CHOICES = [("М", "Мужской"), ("Ж", "Женский")]
    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80)
    middle_name = models.CharField(max_length=80, blank=True)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default="М")
    birth_date = models.DateField()
    sport = models.CharField(max_length=60)
    position = models.CharField(max_length=80)
    club = models.ForeignKey(Club, related_name="athletes", on_delete=models.SET_NULL, null=True, blank=True)
    number = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="Активен")
    height = models.PositiveSmallIntegerField(default=180)
    weight = models.PositiveSmallIntegerField(default=75)
    medical_notes = models.TextField(blank=True)
    achievements = models.JSONField(default=list, blank=True)
    photo_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ["last_name", "first_name"]
    @property
    def age(self):
        from datetime import date
        today = date.today()
        return today.year - self.birth_date.year - ((today.month, today.day) < (self.birth_date.month, self.birth_date.day))
    @property
    def name(self): return f"{self.first_name} {self.last_name}"
    @property
    def full_name(self): return " ".join(x for x in (self.first_name, self.last_name, self.middle_name) if x)
    def __str__(self): return self.full_name

class Transfer(models.Model):
    STATUS_CHOICES = [("Одобрен", "Одобрен"), ("В процессе", "В процессе"), ("Отклонён", "Отклонён")]
    athlete = models.ForeignKey(Athlete, related_name="transfers", on_delete=models.CASCADE)
    from_club = models.ForeignKey(Club, related_name="outgoing_transfers", on_delete=models.SET_NULL, null=True, blank=True)
    to_club = models.ForeignKey(Club, related_name="incoming_transfers", on_delete=models.SET_NULL, null=True, blank=True)
    date = models.DateField()
    amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="В процессе")
    note = models.CharField(max_length=240, blank=True)
    class Meta: ordering = ["-date"]
    def __str__(self): return f"{self.athlete}: {self.from_club} → {self.to_club}"

class Event(models.Model):
    TYPE_CHOICES = [(x, x) for x in ("Турнир", "Матч", "Встреча")]
    title = models.CharField(max_length=180)
    type = models.CharField(max_length=32, choices=TYPE_CHOICES, default="Турнир")
    date = models.DateField()
    time = models.TimeField()
    location = models.CharField(max_length=180)
    clubs = models.ManyToManyField(Club, related_name="events", blank=True)
    description = models.TextField(blank=True)
    class Meta: ordering = ["date", "time"]
    def __str__(self): return self.title
