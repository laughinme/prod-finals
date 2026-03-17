import os


QDRANT_URL = os.getenv("QDRANT_URL", "http://qdrant:6333")


DATA_PATH = "transaction_600_new.csv"
LIMIT_USERS = 600


COLLECTION_NAME = "user_profiles"
