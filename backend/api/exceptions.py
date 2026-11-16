from rest_framework.views import exception_handler

from .utils import clean_errors


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None
    response.data = {
        "error": {
            "status": response.status_code,
            "details": clean_errors(response.data),
        }
    }
    return response
