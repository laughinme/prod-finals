import pandas as pd
import numpy as np
import os
from catboost import CatBoostClassifier
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

DATA_PATH = 'transaction_600_new.csv' 
                  
RANDOM_SEED = 42
COLLECTION_NAME = "user_profiles"
client = QdrantClient(url="http://localhost:6333")

class MlRuntime:
    def __init__(self):
        self.status = MlStatus.down
        
                                                                          
        self.qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
        self.data_path = os.getenv("ML_TRAIN_DATA_PATH", "/app/ml/data/train.csv")
        self.train_on_start = os.getenv("ML_TRAIN_ON_START", "false").lower() == "true"
        
                                                     
        self.client = QdrantClient(url=self.qdrant_url)
        self.collection_name = "user_profiles"
        
        self.profiles_cache = None
        self.user_stats = {}

        if self.train_on_start:
                self._bootstrap()
                self.status = MlStatus.ok
        else:
            self.status = MlStatus.ok 

    def _bootstrap(self):                                                                
        sample_count = int(os.getenv("ML_SAMPLE_USER_COUNT", 100))
        df = pd.read_csv(self.data_path)
                                                   
        self._sync_to_qdrant(profiles_scaled, df)

    def _sync_to_qdrant(self, profiles_df, df_enriched):
                                                                           
        pass
def create_user_profiles(df, user_col='party_rk', category_col='category_nm', time_col='hour'):
    df = df.copy()
    df[category_col] = df[category_col].fillna('unknown')

                                
    user_cat_dist = (
        df.groupby([user_col, category_col])
          .size()
          .unstack(fill_value=0)
          .astype(np.float64)                     
    )
    
                                            
    row_sums = user_cat_dist.sum(axis=1)
    user_cat_dist = user_cat_dist.div(row_sums.replace(0, 1), axis=0)

                               
    user_time = df.groupby(user_col)[time_col].mean().rename('hour').astype(np.float64)

                
    profiles = pd.concat([user_cat_dist, user_time], axis=1).fillna(0)

                                                 
    scaler = StandardScaler()
                                                                           
    profiles_scaled = pd.DataFrame(
        scaler.fit_transform(profiles),
        index=profiles.index,
        columns=profiles.columns
    )

                                                            
                                                                           
    profiles_scaled += 1e-9 

    return profiles_scaled

def get_matches(target_rk, profiles_df, top_n=5):
    if target_rk not in profiles_df.index:
        return pd.DataFrame(columns=['party_rk', 'score'])

                                                     
    matrix = profiles_df.values
    target_idx = profiles_df.index.get_loc(target_rk)
    target_vec = matrix[target_idx].reshape(1, -1)

                                                                                     
    with np.errstate(divide='ignore', invalid='ignore'):
        similarities = cosine_similarity(target_vec, matrix)[0]
    
                                             
    similarities = np.nan_to_num(similarities)

    match_results = pd.DataFrame({
        'party_rk': profiles_df.index,
        'score': similarities
    })

                                     
    match_results = (
        match_results[match_results['party_rk'] != target_rk]
        .sort_values(by='score', ascending=False)
        .head(top_n)
        .reset_index(drop=True)
    )

    return match_results

def run_ml_logic():
                                 
    print("1. Загрузка данных...")
    cols = ['party_rk', 'category_nm', 'merchant_type_code', 'merchant_nm', 'real_transaction_dttm']
    df = pd.read_csv(DATA_PATH, usecols=cols)

    unique_users = df['party_rk'].unique()
    sampled_users = unique_users
    df = df[df['party_rk'].isin(sampled_users)].copy()
    print(f"Выборка: {len(sampled_users)} пользователей, {len(df)} транзакций.")

                                   
    df['real_transaction_dttm'] = pd.to_datetime(df['real_transaction_dttm'])
    df['hour'] = df['real_transaction_dttm'].dt.hour
    df['day_of_week'] = df['real_transaction_dttm'].dt.dayofweek
    df['merchant_type_code'] = df['merchant_type_code'].astype(str)
    df['merchant_nm'] = df['merchant_nm'].fillna('unknown')

                                                    
    train_df = df[df['category_nm'].notna()].copy()
    predict_df = df[df['category_nm'].isna()].copy()

    if len(predict_df) > 0:
        print("2. Обучение CatBoost для восстановления категорий...")
        model = CatBoostClassifier(
            iterations=150,
            verbose=0,
            text_features=['merchant_nm'],
            cat_features=['merchant_type_code']
        )
        model.fit(
            train_df[['merchant_type_code', 'merchant_nm', 'hour', 'day_of_week']],
            train_df['category_nm']
        )
        preds = model.predict(predict_df[['merchant_type_code', 'merchant_nm', 'hour', 'day_of_week']])
        df.loc[df['category_nm'].isna(), 'category_nm'] = preds.flatten()
        print("Категории восстановлены.")

    print("3. Создание профилей (векторизация интересов)...")
    profiles = create_user_profiles(df)

    return df, profiles

def format_hour(float_hour):
    return f"{int(float_hour):02d}:00"


                

df_enriched, user_profiles = run_ml_logic()

                                                            
             
user_raw_hours = df_enriched.groupby('party_rk')['hour'].mean().to_dict()
                            
user_top_cats = df_enriched.groupby('party_rk')['category_nm'].agg(lambda x: x.value_counts().index[0]).to_dict()

                           
random_user = user_profiles.index[10] 
target_hour = user_raw_hours[random_user]
target_cat = user_top_cats[random_user]

print(f"\nИщем пару для: {random_user}")
print(f"Профиль: Любит '{target_cat}', активен в районе {format_hour(target_hour)}")

matches = get_matches(random_user, user_profiles)

print("\nMatch!")
for i, row in matches.iterrows():
    m_rk = row['party_rk']
    m_score = row['score']
    m_hour = user_raw_hours[m_rk]
    m_cat = user_top_cats[m_rk]
    
                                
    time_diff = abs(target_hour - m_hour)
    
                              
    if time_diff <= 1:
        time_msg = "в то же время, что и вы"
    elif time_diff <= 3:
        time_msg = "почти в то же время"
    else:
        time_msg = "в другое время дня"

    print(f"\n Мэтч #{i+1} (Сходство: {m_score:.1%})")
    print(f"ID: {m_rk}")
    print(f" Этот пользователь подходит он часто выбирает '{m_cat}'.")
    print(f" он совершает покупки {time_msg} (около {format_hour(m_hour)}).")