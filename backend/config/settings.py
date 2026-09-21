import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.environ.get("DEBUG", "1") == "1"
SECRET_KEY = os.environ.get("SECRET_KEY", "local-development-only")
if not DEBUG and SECRET_KEY == "local-development-only":
    raise RuntimeError("Set SECRET_KEY before running in production.")
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1,testserver").split(",")
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
INSTALLED_APPS = ["django.contrib.staticfiles", "planner"]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
TEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates", "DIRS": [BASE_DIR.parent / "frontend/dist"]}]
STATIC_URL = "/assets/"
STATIC_ROOT = BASE_DIR.parent / "staticfiles"
STATICFILES_DIRS = [BASE_DIR.parent / "frontend/dist/assets"] if (BASE_DIR.parent / "frontend/dist/assets").exists() else []
STORAGES = {"staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"}}
USE_TZ = True
DATA_UPLOAD_MAX_MEMORY_SIZE = 32_768
ORS_API_KEY = os.environ.get("ORS_API_KEY", "")
CSRF_TRUSTED_ORIGINS = [s for s in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",") if s]
if DEBUG:
    CSRF_TRUSTED_ORIGINS += ["http://127.0.0.1:5173", "http://localhost:5173"]
SECURE_CONTENT_TYPE_NOSNIFF = True
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG
SECURE_SSL_REDIRECT = os.environ.get("SECURE_SSL_REDIRECT", "0") == "1"
# Container health probes use internal HTTP even when the public endpoint uses HTTPS.
SECURE_REDIRECT_EXEMPT = [r"^api/health$"]
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG
# ponytail: process-local cache; use a shared cache if multiple replicas exhaust provider quota.
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "routing"}}
