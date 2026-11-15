import os

# api.config refuses to load without these. The tests never connect to the database,
# so placeholder values are enough; real ones (e.g. from .env) take precedence.
os.environ.setdefault("POSTGRES_USER", "test")
os.environ.setdefault("POSTGRES_PASSWORD", "test")
os.environ.setdefault("POSTGRES_DB", "test")
