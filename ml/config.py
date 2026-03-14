import os

# Qdrant configuration
QDRANT_URL = os.getenv("QDRANT_URL", "http://qdrant:6333")

# Data configuration
DATA_PATH = "transaction_600_new.csv"
LIMIT_USERS = 600

# Collection configuration
COLLECTION_NAME = "user_profiles"