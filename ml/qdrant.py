import pandas as pd
import numpy as np
from catboost import CatBoostClassifier
from sklearn.preprocessing import StandardScaler
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
import config
import joblib 
import uuid
from qdrant_client.models import PointStruct


def string_to_uuid(string: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, string))

def run_ingestion():
    client = QdrantClient(host="qdrant", port=6333)
    
    print("1. Загрузка и очистка данных...")
    df = pd.read_csv(config.DATA_PATH)
    unique_users = df['party_rk'].unique()[:config.LIMIT_USERS]
    df = df[df['party_rk'].isin(unique_users)].copy()

    df['real_transaction_dttm'] = pd.to_datetime(df['real_transaction_dttm'])
    df['hour'] = df['real_transaction_dttm'].dt.hour
    df['day_of_week'] = df['real_transaction_dttm'].dt.dayofweek
    df['merchant_type_code'] = df['merchant_type_code'].fillna('unknown').astype(str)
    df['merchant_nm'] = df['merchant_nm'].fillna('unknown').astype(str)

    # 2. CatBoost Enrichment

    train_df = df[df['category_nm'].notna()]
    predict_df = df[df['category_nm'].isna()]
    if len(predict_df) > 0:
        # ДОБАВЬ ЭТОТ ПРИНТ, чтобы понимать масштаб беды :)
        print(f"2. Обучение CatBoost... Размер train: {len(train_df)} строк, predict: {len(predict_df)} строк")
        
        model = CatBoostClassifier(
            iterations=105,        # <-- УМЕНЬШИЛИ с 150 до 30 (для быстрого теста этого хватит) груповое мочилово
            verbose=5,            # <-- ВАЖНО: теперь каждые 5 итераций он будет писать прогресс в консоль
            text_features=['merchant_nm'],
            cat_features=['merchant_type_code'],
            thread_count=4        # <-- ОГРАНИЧИМ ПОТОКИ (чтобы Docker не задохнулся от нехватки CPU)
        )
        model.fit(
            train_df[['merchant_type_code', 'merchant_nm', 'hour', 'day_of_week']],
            train_df['category_nm']
        )
        preds = model.predict(predict_df[['merchant_type_code', 'merchant_nm', 'hour', 'day_of_week']])
        df.loc[df['category_nm'].isna(), 'category_nm'] = preds.flatten()
        print("✅ Категории успешно восстановлены.")
    # 3. Векторизация
    print("3. Создание профилей...")
    cat_dist = df.groupby(['party_rk', 'category_nm']).size().unstack(fill_value=0).astype(float)
    cat_dist = cat_dist.div(cat_dist.sum(axis=1), axis=0)
    avg_hour = df.groupby('party_rk')['hour'].mean().rename('hour')
    profiles = pd.concat([cat_dist, avg_hour], axis=1).fillna(0)
    
    scaler = StandardScaler()
    profiles_scaled = pd.DataFrame(scaler.fit_transform(profiles), index=profiles.index, columns=profiles.columns)
    joblib.dump(scaler, 'models/scaler.joblib')
    joblib.dump(profiles.columns.tolist(), 'models/features_list.joblib')

    # 4. Заливка в Qdrant
    print(f"4. Синхронизация с Qdrant (Коллекция: {config.COLLECTION_NAME})...")
    if client.collection_exists("user_profiles"):
        client.delete_collection("user_profiles")

    client.create_collection(
        collection_name="user_profiles",
        vectors_config=VectorParams(
            size=profiles_scaled.shape[1],
            distance=Distance.COSINE
        ),
    )

    user_raw_hours = df.groupby('party_rk')['hour'].mean().to_dict()
    user_top_cats = (
        df.groupby('party_rk')['category_nm']
        .agg(lambda x: x.dropna().mode().iloc[0] if len(x.dropna()) > 0 else "unknown")
        .to_dict()
    )
    points = [
    PointStruct(
        id=string_to_uuid(str(rk)),
        vector=row.values.tolist(),
        payload={
            "party_rk": str(rk),
            "top_cat": str(user_top_cats.get(rk, "unknown"))
        }) for rk, row in profiles_scaled.iterrows()
]
    client.upsert(collection_name=config.COLLECTION_NAME, points=points)
    print("✅ Данные успешно загружены в Qdrant!")
if __name__ == "__main__":
    run_ingestion()