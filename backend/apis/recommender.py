from flask_restx import Namespace, Resource, fields 
import models
from utils.token import Token
from flask import request
import sqlite3
import os
import random 

from .item import get_all_profiles

import pandas as pd
from scipy import stats
from sklearn.preprocessing import MinMaxScaler


api = Namespace(
    'recommender',
    description="""Recommend upon 4 aspects: popularity, sale records, customer view history, items similarity"""
)


@api.route('/item')
class ItemBasedRecommender(Resource):
    @api.response(200, "OK")
    @api.response(204, "Customer with no purchase and rating record")
    @api.response(403, "No authorization token / token invalid / token expired")
    @api.response(404, "Invalid user_id")
    @api.expect(models.token_header)
    @api.doc(description="Recommend items based on popularity and user similarity. Require token. Return 8 items.")
    def get(self):
        """Recommend items based on popularity and user similarity (need token)"""

        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return "No authorization token", 403
        
        T = Token()
        identity = T.check(auth_header)
        
        if not identity:
            return "Wrong token", 403
        
        sql = """SELECT * FROM customer_rating"""

        u_id = identity['user_id']

        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()

                r1 = cur.execute(sql)
                result = r1.fetchall()

                # user-rating table
                user_rating = pd.DataFrame(result)
                
                #if user has not purchased anything before
                if u_id not in user_rating.user_id.values:
                    return "user has not purchased anything",204
                
                # mean ratint rated by each user
                ratings_mean_count = pd.DataFrame(
                    user_rating.groupby('item_id')['rating'].mean().sort_values(ascending=False))
                
                ratings_mean_count['rating_counts'] = pd.DataFrame(user_rating.groupby('item_id')['rating'].count())
                
                popular = ratings_mean_count.sort_values(['rating_counts', 'rating'], ascending=False).reset_index()
                
                pop_item = popular['item_id'].values.tolist()
                
                df = user_rating.pivot_table(index='user_id', columns='item_id', values='rating')
                
                # common part item rated by user pair
                def build_xy(user_id1, user_id2):
                    bool_array = df.loc[user_id1].notnull() & df.loc[user_id2].notnull()
                    return df.loc[user_id1, bool_array], df.loc[user_id2, bool_array]


                # pearsonr to count similarity of user pair
                def pearson(user_id1, user_id2):
                    x, y = build_xy(user_id1, user_id2)
                    mean1, mean2 = x.mean(), y.mean()
                    denominator = (sum((x - mean1) ** 2) * sum((y - mean2) ** 2)) ** 0.5
                    try:
                        value = sum((x - mean1) * (y - mean2)) / denominator
                    except ZeroDivisionError:
                        value = 0
                    return value
                

                # find nearest user
                def computeNearestNeighbor(user_id, k=8):
                    # the customer may not have purchased before
                    # so need to check, if no purchase, return none
                    # print("1111",df.drop(user_id).index.to_series().apply(pearson, args=(user_id,)).nlargest(k))

                    return df.drop(user_id).index.to_series().apply(pearson, args=(user_id,)).nlargest(k)


                ####CF user-based rec
                def recommend(user_id):
                    # find nearest user_id
                    result = 0

                    nearest_user_id_list = computeNearestNeighbor(user_id).index.tolist()
                    #find out the item that is rated by neighbour but not user self
                    #in case nearest user has the same rated item as user self.
                    for nearest_user_id in nearest_user_id_list:
                        k_near = df.loc[nearest_user_id, df.loc[user_id].isnull() & df.loc[nearest_user_id].notnull()]
                        if len(k_near.values) != 0:
                            result = k_near.sort_values(ascending=False)

                            # print("result:",result[:5].index)
                            break

                    ###get top 5
                    return result[:5].index
                
                # if no purchase record, return 204
                rec_result = recommend(u_id)
                # print(rec_result)

                # for customer with purchase record
                all_result= []
                
                for i in rec_result:
                    all_result.append(i)
                
                #recommend to users: top_k
                top_k = 8
                
                for i in pop_item:
                    if len(all_result) < top_k and i not in all_result:
                        all_result.append(i)
                    elif len(all_result) >= 5:
                        break

                p_all = []
                
                for i in all_result:
                    profile = {}
                    profile['item_id'] = int(i)
                    p_all.append(profile)
                
                r = get_all_profiles(p_all)
                return r, 200

        except Exception as e:
            print(e)
            return "Internal server error", 500



@api.route('/topview')
class PopularityBasedRecommender(Resource):
    @api.response(200, "OK", models.item_profile_list)
    @api.response(500, "Internal Server Error")
    @api.doc(description="Recommend items based on most-viewed item. No token required. Return 8 items")
    def get(self):
        """Return top viewed products (no token)"""
        
        top_k = 8
        
        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()

                # get the top 30 most view items, and return 8 in random
                sql = """SELECT item_id FROM item WHERE status = 1 ORDER BY view DESC LIMIT 30"""

                cur.execute(sql)
                item_id_list = cur.fetchall()

                random.shuffle(item_id_list)
                
                r = get_all_profiles(item_id_list[:top_k])
                
                return r, 200
        
        except Exception as e:
            print(e)
            return "Internal server error", 500


@api.route('/viewhistory')
class ViewHistoryBasedRecommender(Resource):
    @api.response(200, "OK")
    @api.response(204, "New user, no view history yet")
    @api.response(403, "No authorization token / token invalid / token expired")
    @api.response(404, "Invalid user_id")
    @api.expect(models.token_header)
    @api.doc(description="Recommend items based on the user's view history. Require token. Return 5 items")
    def get(self):
        """Recommend items based on user view history (need token)"""

        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return "No authorization token", 403
        
        T = Token()

        identity = T.check(auth_header)
        if not identity:
            return "Wrong token", 403
        
        sql = """
                SELECT view_history.*
                FROM view_history, item
                WHERE view_history.item_id = item.item_id 
                AND item.status = 1
            """
        
        sql2 ="""
                SELECT item.*
                FROM item
                WHERE item.status = 1
            """
        
        sql3 = """
                SELECT laptop.*
                FROM laptop, item
                WHERE laptop.item_id = item.item_id 
                AND item.status = 1
            """
        
        u_id = identity['user_id']
        
        #####item-feature
        fea = [
            'item_id', 'price',
            'cpu_lithography', 'cpu_cache', 'cpu_base_speed', 'cpu_boost_speed',
            'cpu_cores', 'cpu_tdp', 'cpu_rating',
            'cpu_integrated_video_id', 'display_size',
            'display_horizontal_resolution', 'display_vertical_resolution',
            'display_sRGB',
            'memory_size', 'memory_speed',
            'primary_storage_cap',
            'primary_storage_read_speed',
            'gpu_lithography', 'gpu_shaders', 'gpu_base_speed',
            'gpu_boost_speed', 'gpu_shader_speed', 'gpu_memory_speed',
            'gpu_memory_bandwidth', 'gpu_memory_size',
            'gpu_rating',
            'wireless_card_speed',
            'chassis_height_cm', 'chassis_height_inch',
            'chassis_depth_cm', 'chassis_depth_inch', 'chassis_width_cm',
            'chassis_width_inch', 'chassis_weight_kg', 'chassis_weight_lb',
            'battery_capacity',
            'config_score',
            'battery_life_raw', 'total_storage_capacity'
        ]
        

        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                
                cur = conn.cursor()
                cu1 = conn.cursor()
                cu2 = conn.cursor()
                
                r = cur.execute(sql)
                r2 =cu1.execute(sql2)
                r3 = cu2.execute(sql3)
                
                result,result1,result2 = r.fetchall(),r2.fetchall(),r3.fetchall()
                
                view_history,item,laptop = pd.DataFrame(result),pd.DataFrame(result1),pd.DataFrame(result2)
            
                most_view = pd.DataFrame(
                    view_history.groupby('user_id')['item_id'].agg(lambda x: stats.mode(x)[0])).reset_index()
                

                # if this user does not have any view history
                # then return 204
                if not most_view[most_view['user_id']==u_id]['item_id'].any():
                    return "New user, no view history", 204 


                # for users with view history
                i_id = most_view[most_view['user_id']==u_id]['item_id'].values[0]
                
                all_lap = item.merge(laptop, on='item_id', how='left')
                
                item_fea = all_lap[fea].set_index('item_id')
                
                new_item = MinMaxScaler().fit_transform(item_fea)
                
                new_df = pd.DataFrame(new_item, columns=fea[1:])
                
                df = pd.DataFrame(all_lap['item_id'])
                
                nor_item = pd.concat((new_df, df), axis=1).set_index("item_id")
                
                def build_xy(item_id1, item_id2):
                    bool_array = nor_item.loc[item_id1].notnull() & nor_item.loc[item_id2].notnull()
                    return nor_item.loc[item_id1, bool_array], nor_item.loc[item_id2, bool_array]
                
                ###pearsonr to calculate similarity of pair item
                def pearson(item_id1, item_id2):
                    x, y = build_xy(item_id1, item_id2)
                    mean1, mean2 = x.mean(), y.mean()
                    denominator = (sum((x - mean1) ** 2) * sum((y - mean2) ** 2)) ** 0.5
                    try:
                        value = sum((x - mean1) * (y - mean2)) / denominator
                    except ZeroDivisionError:
                        value = 0
                    return value
                
                #####find out nearest item
                def computeNearestNeighbor(item_id, k):
                    return nor_item.drop(item_id).index.to_series().apply(pearson, args=(item_id,)).nlargest(k)
                
                KNN_item = computeNearestNeighbor(i_id,5).index.tolist()
                p_all = []
                
                for i in KNN_item:
                    profile = {}
                    profile['item_id'] = int(i)
                    p_all.append(profile)

                r = get_all_profiles(p_all)
                return r, 200

        except Exception as e:
            print(e)
            return "Internal server error", 500


@api.route('/topselling')
class TopSelling(Resource):
    @api.response(200, "OK", models.item_profile_list)
    @api.response(500, "Internal Server Error")
    @api.doc(description="Recommend top (8 from 20) selling products. Each fetch may return slightly different items / order. Return 8 items.")
    def get(self):
        """Return top selling products (no token)"""
        
        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()

                # find top 20 products that people bought, and order using number descending
                # then pick random 8 from them. 
                # also notice, only choose those currently on sale

                sql = """
                    SELECT order_item.item_id, SUM(order_item.quantity) AS total
                    FROM order_item LEFT OUTER JOIN item ON order_item.item_id = item.item_id
                    WHERE item.status = 1
                    GROUP BY order_item.item_id
                    ORDER BY total DESC
                    LIMIT 20
                """

                cur.execute(sql)
                item_id_list = cur.fetchall()

                # require to return 8, check whether the length > 8
                top_k = 8
                
                random.shuffle(item_id_list)

                response = get_all_profiles(item_id_list[:top_k])
                
                return response, 200
        
        except Exception as e:
            print(e)
            return "Internal server error", 500


@api.route("/random")
class RandomForBanner(Resource):
    @api.response(200, "OK", models.banners)
    @api.response(500, "Internal Server Error")
    @api.doc(description="Return random image for the home page banner. Response comes with the item_id and name. Default return 10.")
    def get(self):
        """Random images for the home page banner (no token)"""

        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()
                
                # get random 10 id
                sql_1 = """
                    SELECT item_id, name
                    FROM item
                    WHERE status = 1
                    ORDER BY RANDOM()
                    LIMIT 10
                """

                cur.execute(sql_1)
                result = cur.fetchall()

                # now iterate it, and add a photo to each
                for i in range(len(result)):
                    sql_2 = """SELECT photo FROM photo WHERE item_id = ? ORDER BY RANDOM() LIMIT 1"""
                    sql_2_param = (result[i]['item_id'],)

                    cur.execute(sql_2, sql_2_param)
                    result_2 = cur.fetchone()

                    result[i]['photo'] = result_2['photo']
                
                return result, 200

        except Exception as e:
            print(e)
            return "Internal server error", 500

