from flask_restx import Namespace, Resource, fields
from flask import request, abort
import sqlite3 
import os 

import models
from utils.token import Token

api = Namespace(
    'rating',
    description="After placing order, the customer can rate the item. And all others can view the ratings"
)


@api.route('/<item_id>')
class Rating(Resource):
    @api.response(200, "OK")
    @api.response(400, "Missing item_id")
    @api.response(401, "Invalid item_id")
    @api.response(404, "Not Found")
    @api.doc(description="Return an array with 5 entries, each entry represents how many people has voted for this ranking.")
    def get(self, item_id):
        # request the item_id
        if not item_id:
            return "Missing item_id", 400

        try:
            item_id = int(item_id)
        except ValueError:
            return "item_id should be integer", 401

        if item_id <= 0:
            return "item_id should be positive", 401

        sql_1 = """
                SELECT rating
                FROM customer_rating
                WHERE item_id = ?
        """

        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()

                cur.execute(sql_1, (int(item_id),))
                ratings = cur.fetchall()
                if not ratings:
                    return "No record", 404
                else:
                    # rating from 1 to 5
                    # the result returns the number of counts for each rating
                    result = [0,0,0,0,0]

                    for i in range(len(ratings)):
                        result[ratings[i]['rating'] - 1] += 1
                    return result, 200 

        except Exception as e:
            print(e)
            return "Internal server error", 500 


    @api.response(200, "OK")
    @api.response(400, "Missing item_id")
    @api.response(401, "Invalid item_id / Invalid rating")
    @api.response(403, "No authorization token / token invalid / token expired")
    @api.response(404, "Not Found")
    @api.expect(models.token_header, models.rating)
    @api.doc(description="Only users who bought this item before can submit/update the ranking. ")
    def put(self, item_id):
        # first check the auth token
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return "No authorization token", 403
        
        T = Token()
        identity = T.check(auth_header)
        if not identity:
            return "Wrong token", 403

        # request the item_id
        if not item_id:
            return "Missing item_id", 400

        try:
            item_id = int(item_id)
        except ValueError:
            return "item_id should be integer", 401

        if item_id <= 0:
            return "item_id should be positive", 401

        # check if the token user bought the item or not
        sql_1 = """
                SELECT * 
                FROM (
                    SELECT  * 
                    FROM orders,order_item 
                    WHERE orders.ord_id = order_item.ord_id
                )
                WHERE user_id = ? and item_id = ?
        """

        sql_param = (identity['user_id'], item_id)

        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()

                cur.execute(sql_1, sql_param)
                result = cur.fetchall()
                if not result:
                    return "You need to purchase before rating. ", 404

        except Exception as e:
            print(e)
            return "Internal server error", 500 

        #get the new rating
        print(request.json)

        new_rating = request.json.get("Rating")    # get the new rating from the json straight away
        if not new_rating:
            return "Malformed request", 400

        #check validity: check integer first, and then check the range between 1 to 5
        if not isinstance(new_rating, int):
            return "Rating must be an integer"

        if new_rating < 1 or new_rating > 5:
            return "Rating should be between 1 and 5", 401

        #check whether user wants to submit new ranking or update old rating
        sql_2 = """
                SELECT * 
                FROM customer_rating
                WHERE user_id = ? and item_id = ?
        """

        #submit new ranking
        sql_3 = """
                INSERT INTO customer_rating VALUES (?, ?, ?)
        """

        sql_param_2 = (identity['user_id'], item_id, new_rating)

        #update old rating
        sql_4 = """
                UPDATE customer_rating
                SET rating = ?
                WHERE user_id = ? AND item_id = ?
        """
        sql_param_3 = (new_rating, identity['user_id'], item_id)

        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()

                # first check if the customer has rated before
                cur.execute(sql_2, sql_param)
                result = cur.fetchall()

                # if not rated, then insert
                if not result:
                    cur.execute(sql_3, sql_param_2)
                    return "OK", 200
                else:
                    # if rated already, then update
                    cur.execute(sql_4, sql_param_3)
                    return "OK", 200
        except Exception as e:
            print(e)
            return "Internal server error", 500


@api.route('/myrating')
class Rating(Resource):
    @api.response(200, "OK", models.my_rating)
    @api.response(403, "No authorization token / token invalid / token expired / Not a customer")
    @api.response(204, "No purchase records yet")
    @api.expect(models.token_header)
    @api.doc(description="""
        Customers can review all ratings for purchased items.
        These ratings help to recommend products to the customer. 
    """)
    def get(self):
        # first check the auth token
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return "No authorization token", 403
        
        T = Token()
        identity = T.check(auth_header)
        if not identity:
            return "Wrong token", 403

        if identity['role'] != 1:
            return "Not customer", 403
        

        # select all purchased items left outer join ratings
        sql_1 = """
            SELECT purchases.item_id, customer_rating.rating
            FROM 
                (SELECT item_id FROM order_item, orders WHERE order_item.ord_id = orders.ord_id and user_id = ?) AS purchases 
                LEFT OUTER JOIN customer_rating 
                ON purchases.item_id = customer_rating.item_id AND customer_rating.user_id = ?
        """

        param_1 = (identity['user_id'], identity['user_id'])

        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()
                cur.execute(sql_1, param_1)

                result = cur.fetchall()

                if len(result) == 0:
                    return "No purchase records yet", 204
                else:
                    # add the item name and photo into it
                    for d in result:
                        sql_2 = "SELECT name FROM item WHERE item_id = {}".format(d['item_id'])
                        sql_3 = "SELECT photo FROM photo WHERE item_id = {} LIMIT 1".format(d['item_id'])

                        cur.execute(sql_2)
                        d['name'] = cur.fetchone()['name']

                        cur.execute(sql_3)
                        d['photo'] = cur.fetchone()['photo']

                    return result, 200

        except Exception as e:
            print(e)
            return "Internal server error", 500 

