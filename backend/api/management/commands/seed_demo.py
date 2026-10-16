from datetime import date, time, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from api.models import Athlete, Club, Event, Transfer

class Command(BaseCommand):
    help = "Creates a realistic demo dataset and a local demo manager account."
    def handle(self, *args, **options):
        clubs_data = [("Алматы Арланс","AA",1998,"Премьер-лига","Ерлан Садыков","#315fd2"),("Астана Титанс","AT",2004,"Премьер-лига","Марат Нурланов","#8f63ce"),("Шымкент Фэлконс","SF",1989,"Национальная лига","Руслан Ахметов","#d78a43"),("Караганда Стил","KS",2010,"Национальная лига","Айдар Ким","#328d7a"),("Актау Уэйвс","AW",2001,"Региональная лига","Данияр Омаров","#4e91bb")]
        clubs = [Club.objects.update_or_create(name=name, defaults={"short_name":short,"founded":founded,"league":league,"coach":coach,"color":color})[0] for name,short,founded,league,coach,color in clubs_data]
        people = [("Александр","Волков","Петрович","М"),("Данияр","Садыков","Ерланович","М"),("Алина","Ким","Сергеевна","Ж"),("Тимур","Нурланов","Аскарович","М"),("Мадина","Ахметова","Руслановна","Ж"),("Арман","Ибраев","Бауыржанович","М"),("София","Морозова","Андреевна","Ж"),("Ермек","Толеуов","Канатович","М"),("Диана","Серикова","Маратовна","Ж"),("Никита","Орлов","Викторович","М"),("Аружан","Бекова","Даулетовна","Ж"),("Михаил","Кравцов","Игоревич","М"),("Ильяс","Жумабаев","Талгатович","М"),("Виктория","Ли","Алексеевна","Ж"),("Руслан","Баймуханов","Серикович","М"),("Камилла","Абдрахманова","Олеговна","Ж"),("Азамат","Касымов","Ермекович","М"),("Ева","Кузнецова","Павловна","Ж"),("Санжар","Оспанов","Муратович","М"),("Полина","Соколова","Дмитриевна","Ж"),("Бекзат","Есенов","Нурланович","М"),("Амина","Турсунова","Аскаровна","Ж"),("Дмитрий","Фомин","Олегович","М"),("Карина","Юсупова","Рашидовна","Ж")]
        sports = ["Футбол","Баскетбол","Хоккей","Волейбол"]
        states = ["Активен","Активен","Активен","Травма","Активен","Активен","Дисквалификация","Активен","Активен","Завершил карьеру"]
        athletes=[]
        for i in range(42):
            fn,ln,mn,gender=people[i%len(people)]; year=1987+i*7%19; birth=date(year,i%12+1,i%27+1)
            athlete,_=Athlete.objects.update_or_create(first_name=fn,last_name=ln,middle_name=mn,birth_date=birth,defaults={"gender":gender,"sport":sports[i%4],"position":["Нападающий","Защитник","Полузащитник","Вратарь"][i%4],"club":clubs[i%5],"number":i*7%99+1,"status":states[i%10],"height":168+i*11%34,"weight":58+i*3%42,"medical_notes":"Восстановление после растяжения; индивидуальная нагрузка." if states[i%10]=="Травма" else "Ограничений нет. Допущен к тренировкам.","achievements":[f"Чемпион {2022+i%4} года",["Лучший игрок сезона","Кубок федерации","Сборная тура"][i%3]]})
            athletes.append(athlete)
        for i, athlete in enumerate(athletes):
            Athlete.objects.filter(pk=athlete.pk).update(created_at=timezone.now()-timedelta(days=i*4))
        today=timezone.localdate()
        for i,(title,kind,days,loc,indices) in enumerate([("Кубок Федерации — полуфинал","Турнир",2,"Алматы Арена",[0,1]),("Матч национальной лиги","Матч",5,"Дворец спорта Шымкент",[2,3]),("Открытая тренировка фан-клуба","Встреча",8,"Центральный стадион",[0]),("Региональный турнир","Турнир",12,"Спорткомплекс Каспий",[4,2])]):
            event,_=Event.objects.update_or_create(title=title,defaults={"type":kind,"date":today+timedelta(days=days),"time":time(18,30),"location":loc,"description":"Событие федерации. Регистрация участников открыта."}); event.clubs.set([clubs[j] for j in indices])
        for i,athlete in enumerate(athletes[:12]):
            Transfer.objects.update_or_create(athlete=athlete,defaults={"date":today-timedelta(days=20+i*9),"from_club":clubs[(i+2)%5],"to_club":athlete.club,"amount":Decimal(12500000+i*250000),"status":"Одобрен" if i%2==0 else "В процессе","note":"Демо переход"})
        User=get_user_model()
        if not User.objects.filter(username="manager").exists(): User.objects.create_user(username="manager",email="manager@fanclub.local",password="FanClub2026!",first_name="Алия",last_name="Мухамедова",title="Менеджер системы")
        self.stdout.write(self.style.SUCCESS(f"Готово: {len(clubs)} клубов, {len(athletes)} спортсменов, {Event.objects.count()} событий. Демо вход: manager / FanClub2026!"))
