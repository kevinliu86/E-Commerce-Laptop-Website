from flask_restx import Namespace, Resource, fields
from flask import request, abort
import sqlite3 
import os 

import models
from utils.token import Token
from utils.function import unpack
from utils.function import check_address, check_mobile, check_name, check_password, check_email
from .item import get_all_profiles
from .user import get_user_profile
from .order import get_this_order_history


api = Namespace(
    'admin',
    description="Admin actions: get all orders, get customer profiles"
)


def check_admin_token(header):
    if not header:
        abort(400, "No authorization token")

    T = Token()
    identity = T.check(header)

    if not identity:
        abort(403, "Wrong token")

    if identity['role'] != 0:
        abort(403, "Only admin can access")

    return identity


def check_positive_integer(num, keyword):
    # some tests on the user_id
    if not num:
        abort(400, "No {}".format(keyword)) 
    
    try:
        num = int(num)
    except ValueError:
        abort(400, "{} should be integer".format(keyword))
    
    if num < 0:
        abort("{} should > 0".format(keyword))
    
    return num


@api.route('/user/<user_id>')
class User(Resource):
    @api.response(200,"OK",models.profile_full)
    @api.response(403,"No authorization token / token invalid / token expired / not admin token")
    @api.response(400, "Invalid user_id")
    @api.expect(models.token_header)
    @api.doc(description="Admin can access a user profile")
    def get(self, user_id):
        identity = check_admin_token(request.headers.get("Authorization"))
        user_id = check_positive_integer(user_id, "user_id")

        # get the profile
        result = get_user_profile(user_id)

        if not result:
            return "Invalid user_id", 400
        else:
            return result, 200


@api.route('/users')
class AllUser(Resource):
    @api.response(200,"OK",models.profile_full_list)
    @api.response(204, "No customers in the database")
    @api.response(403,"No authorization token / token invalid / token expired / not admin token")
    @api.expect(models.token_header)
    @api.doc(description="Admin can access all user profiles")
    def get(self):
        identity = check_admin_token(request.headers.get("Authorization"))
        
        # select all customer id and then loop
        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()

                sql = "SELECT user_id FROM user WHERE role = 1 ORDER BY user_id ASC"
                cur.execute(sql)

                user_id_list = cur.fetchall()

                if len(user_id_list) == 0:
                    return "No customers", 204
                
                result = []

                for id_dict in user_id_list:
                    result.append(get_user_profile(id_dict['user_id']))
                
                return result, 200

        except Exception as e:
            print(e)
            abort(500)        


@api.route('/orders')
class AllOrders(Resource):
    @api.response(200,"OK",models.all_orders_history_list)
    @api.response(204, "No orders at all")
    @api.response(403,"No authorization token / token invalid / token expired / not admin token")
    @api.expect(models.token_header)
    @api.doc(description="Admin can access all orders, classify into new / old orders.")
    def get(self):
        identity = check_admin_token(request.headers.get("Authorization"))
        
        # select all customer id and then loop
        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()

                # select all orders, first select new orders (no tracking number)
                # next select all finished orders
                sql_1 = "SELECT ord_id FROM orders WHERE tracking IS NULL ORDER BY unix_time DESC"
                sql_2 = "SELECT ord_id FROM orders WHERE tracking IS NOT NULL ORDER BY unix_time DESC";

                cur.execute(sql_1)
                res_1 = cur.fetchall()

                cur.execute(sql_2)
                res_2 = cur.fetchall()

                if len(res_1) == 0 and len(res_2) == 0:
                    return "No orders at all", 204
                
                ord_id_list_1 = [e['ord_id'] for e in res_1]
                ord_id_list_2 = [e['ord_id'] for e in res_2]

                new_orders = []
                old_orders = []

                for ord_id in ord_id_list_1:
                    new_orders.append(get_this_order_history(ord_id))
                
                for ord_id in ord_id_list_2:
                    old_orders.append(get_this_order_history(ord_id))
                
                result = {
                    'new': new_orders,
                    'old': old_orders,
                }

                return result, 200 

        except Exception as e:
            print(e)
            abort(500)    


@api.route('/orders/<user_id>')
class OrdersByUserId(Resource):
    @api.response(200,"OK", models.order_history_list)
    @api.response(204, "No orders at all")
    @api.response(400, "Invalid user_id")
    @api.response(403,"No authorization token / token invalid / token expired / not admin token")
    @api.expect(models.token_header)
    @api.doc(description="Admin can access all orders of a particular user.")
    def get(self, user_id):
        identity = check_admin_token(request.headers.get("Authorization"))
        user_id = check_positive_integer(user_id, "user_id")
        
        # select all customer id and then loop
        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()

                # first prove that this user_id exist
                sql_1 = "SELECT * FROM user WHERE user_id = ? AND role = 1"
                sql_1_param = (user_id,)

                cur.execute(sql_1, sql_1_param)
                res_1 = cur.fetchone()

                if not res_1:
                    return "Invalid user_id", 400


                # select all orders, first select new orders (no tracking number)
                # next select all finished orders
                sql_2= "SELECT ord_id FROM orders WHERE user_id = ? ORDER BY unix_time DESC"

                cur.execute(sql_2, sql_1_param)
                res_2 = cur.fetchall()

                if len(res_2) == 0:
                    return "No orders at all", 204
                
                ord_id_list = [e['ord_id'] for e in res_2]

                orders = []

                for ord_id in ord_id_list:
                    orders.append(get_this_order_history(ord_id))

                return orders, 200 

        except Exception as e:
            print(e)
            abort(500)    


@api.route('/orders/<ord_id>')
class OrdersByUserId(Resource):
    @api.response(200,"OK")
    @api.response(400, "Invalid ord_id")
    @api.response(403,"No authorization token / token invalid / token expired / not admin token")
    @api.expect(models.token_header, models.tracking)
    @api.doc(description="Admin can add the tracking number to a new order (tracking number can be repeatly updated).")
    def put(self, ord_id):
        identity = check_admin_token(request.headers.get("Authorization"))
        ord_id = check_positive_integer(ord_id, "ord_id")

        # get the data
        if not request.json:
            return "No tracking data", 400
        
        data = request.json

        if not data['tracking']:
            return "No tracking data", 400
        
        tracking = data['tracking']

        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()

                sql = "UPDATE orders SET tracking = ? WHERE ord_id = ?"
                sql_param = (tracking, ord_id)

                cur.execute(sql, sql_param)

                if cur.rowcount == 0:
                    return "Invalid ord_id", 400
                
                return "OK", 200

        except Exception as e:
            print(e)
            abort(500)    





