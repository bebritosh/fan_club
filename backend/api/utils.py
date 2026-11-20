"""Text normalization and shared athlete helpers.

The model choice constants currently contain strings that were decoded with the
wrong legacy encoding. Keep this adapter until the stored values are migrated.
"""

from django.utils import timezone


def fix_mojibake(value):
    """Repair UTF-8 text that was mistakenly decoded as Windows-1251."""
    if not isinstance(value, str) or not value:
        return value
    if not any(marker in value for marker in ("Р", "С")):
        return value
    try:
        repaired = value.encode("cp1251").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return value
    return repaired if repaired != value else value


def normalize_choice(value, choices):
    """Return the actual model value matching a human or legacy choice."""
    if value is None:
        return value
    normalized = fix_mojibake(str(value)).strip()
    aliases = {
        "ожидает": "В процессе",
        "ожидание": "В процессе",
        "в ожидании": "В процессе",
        "pending": "В процессе",
        "approved": "Одобрен",
        "rejected": "Отклонён",
    }
    normalized = aliases.get(normalized.casefold(), normalized)
    for key, label in choices:
        if normalized.casefold() in {fix_mojibake(str(key)).casefold(), fix_mojibake(str(label)).casefold()}:
            return key
    return value


def calc_age(birth_date, on_date=None):
    if not birth_date:
        return None
    on_date = on_date or timezone.localdate()
    return on_date.year - birth_date.year - (
        (on_date.month, on_date.day) < (birth_date.month, birth_date.day)
    )


def clean_data(value):
    """Recursively repair strings in serializer output."""
    if isinstance(value, str):
        return fix_mojibake(value)
    if isinstance(value, list):
        return [clean_data(item) for item in value]
    if isinstance(value, tuple):
        return [clean_data(item) for item in value]
    if isinstance(value, dict):
        return {key: clean_data(item) for key, item in value.items()}
    return value


def clean_errors(value):
    """Translate common framework errors and keep API validation text Russian."""
    translations = {
        "This field is required.": "Это поле обязательно.",
        "This field may not be blank.": "Поле не может быть пустым.",
        "This field may not be null.": "Поле не может быть пустым.",
        "Enter a valid date.": "Укажите корректную дату.",
        "Enter a valid time.": "Укажите корректное время.",
        "Enter a valid URL.": "Укажите корректный URL.",
        "A valid integer is required.": "Укажите целое число.",
        "A valid number is required.": "Укажите корректное число.",
        "Not a valid string.": "Укажите текстовое значение.",
        "Invalid pk \"{pk_value}\" - object does not exist.": "Объект с таким идентификатором не найден.",
    }
    if isinstance(value, dict):
        return {key: clean_errors(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [clean_errors(item) for item in value]
    if isinstance(value, str):
        value = fix_mojibake(value)
        if value in translations:
            return translations[value]
        if value.isascii() and any(char.isalpha() for char in value):
            return "Переданные данные не прошли проверку."
    return value
