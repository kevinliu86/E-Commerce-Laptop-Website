from flask_restx import Namespace, Resource, fields
from flask import request, abort
import sqlite3 
import os
import json 
import re 
import time 

import models
from utils.token import Token
from utils.function import unpack, check_address, check_mobile, check_name, check_password, check_email
from .item import get_all_profiles


api = Namespace(
    'order',
    description="""Make and get all orders of a customer. The customer can see the specification snapshot of the ordered items at that time."""
)


def get_this_order_history(ord_id):
    try:
        with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
            conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
            cur = conn.cursor()

            sql_1 = """
                SELECT orders.ord_id, orders.user_id, orders.unix_time, orders.total_price,
                    orders.notes, orders.tracking, orders.card_last_four, user.first_name, user.last_name
                FROM user, orders
                WHERE orders.ord_id = ? 
                AND orders.user_id = user.user_id
            """

            sql_1_param = (ord_id,)
            cur.execute(sql_1, sql_1_param)

            order = cur.fetchone()
            
            sql_2 = """
                SELECT order_item.item_id, order_item.price, order_item.quantity, order_item.snapshot
                FROM order_item, item
                WHERE order_item.ord_id = ? AND order_item.item_id = item.item_id
            """

            cur.execute(sql_2, sql_1_param)
            order_items = cur.fetchall()

            # insert into the order
            order["items"] = order_items

            # each order has an address (may be different for different orders)
            # the address is also a dictionary
            sql_3 = """
                SELECT unit_number, street_number, street_name, suburb, state, postcode
                FROM customer_address, orders
                WHERE orders.ord_id = ? AND orders.address_id = customer_address.address_id
            """

            cur.execute(sql_3, sql_1_param)
            address = cur.fetchone()

            # insert, value is a dictionary
            order["address"] = address
            
            return order
    
    except Exception as e:
        print(e)
        abort(500)



@api.route('')
class Order(Resource):
    @api.response(200, "OK", models.order_history_list)
    @api.response(204, "The customer has not made any orders yet")
    @api.response(403, "No authorization token / token invalid / token expired")
    @api.expect(models.token_header)
    @api.doc(description="Retreive all orders for this user. Order time is unix time in seconds. Need to convert into local time.")
    def get(self):
        # check the token first
        # first check the auth token
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return "No authorization token", 403
        
        T = Token()
        identity = T.check(auth_header)
        if not identity:
            return "Wrong token", 403


        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()

                sql_1 = """
                    SELECT orders.ord_id
                    FROM user, orders
                    WHERE user.user_id = orders.user_id AND user.user_id = ?
                    ORDER BY unix_time DESC
                """

                sql_1_param = (identity["user_id"],)
                cur.execute(sql_1, sql_1_param)

                sql_1_result = cur.fetchall()
                order_id_list = [e['ord_id'] for e in sql_1_result]

                if not order_id_list:
                    return "The customer has not made any orders yet", 204
               
                result = []

                for ord_id in order_id_list:
                    result.append(get_this_order_history(ord_id))

                return result, 200
        
        except Exception as e:
            print(e)
            return "Internal server error", 500


    @api.response(200, "OK", models.order_success)
    @api.response(403, "No authorization token / token invalid / token expired")
    @api.response(400, "Wrong format / missing parameter xxx")
    @api.response(409, "Invalid item", models.order_error_invalid_item)
    @api.response(410, "Item removed from shelf", models.order_error_removed)
    @api.response(411, "Item not enough stock", models.order_error_not_enough_stock)
    @api.response(414, "Item wrong price", models.order_error_incorrect_price)
    @api.response(402, "Payment issue: invalid xxx") # this may not be used unless card 4 digis is invalid
    @api.response(413, "Wrong total price", models.order_error_wrong_total_price)
    @api.expect(models.token_header, models.order)
    @api.doc(description="Make order")
    def post(self):
        # check the token first
        # first check the auth token
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return "No authorization token", 403
        
        T = Token()
        identity = T.check(auth_header)
        if not identity:
            return "Wrong token", 403


        # check the payload
        data = request.json
        if not data:
            return "Malformed request", 400
        
        # submit cart
        code, response = submit_order(data, identity)
        return response, code


def submit_order(cart, identity):
    # example cart data format:
    # {
    # "address_id": 0,
    # "notes": "string",
    # "card_last_four": "string",
    # "total_price": "string",
    # "items": [
    #     {
    #     "item_id": 0,
    #     "quantity": 0,
    #     "price": 0
    #     }
    # ]
    # }

    # unpack the first level
    flag, result = unpack(
        cart, 
        "address_id", "notes", "card_last_four", "total_price", "items",
        required=True 
    )

    if not flag:
        return 400, "Missing parameter"
    
    address_id, notes, card_last_four, total_price, items = result 

    # address_id
    try:
        address_id = int(address_id)
        if address_id < 0:
            raise ValueError

    except ValueError:
        return 400, "Parameter address_id must be a positive integer"

    
    try:
        with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
            conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
            cur = conn.cursor()

            sql_1 = """
                SELECT * 
                FROM customer_address
                WHERE user_id = ? AND address_id = ?
            """

            sql_1_param = (identity["user_id"], address_id)
            cur.execute(sql_1, sql_1_param)

            sql_1_result = cur.fetchone()
            if not sql_1_result:
                return 400, "Invalid address_id"

    except Exception as e:
        print(e)
        return 500, "Internal Server Error"
    

    # variable 'notes' no need to check
    # check card_last_four
    if re.match("^\d{4}$", card_last_four) is None:
        return 402, "Invalid card last four digits"


    # check total_price
    # convert to float first, check the amount later 
    try:
        total_price = float(total_price)
        if total_price < 0:
            raise ValueError
    except ValueError:
        return 400, "total price must be positive float"
    

    # check the items
    # "items": [
    #     {
    #     "item_id": 0,
    #     "quantity": 0,
    #     "price": 0
    #     }
    # ]

    if not isinstance(items, list):
        return 400, "key 'items' must be a list"
    
    # store backend_total_price
    order_total_price = 0

    # check the interior
    try:
        with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
            conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
            cur = conn.cursor()

            for item in items:
                flag, result = unpack(
                    item,
                    "item_id", "quantity", "price",
                    required=True 
                )

                if not flag:
                    raise KeyError

                item_id, quantity, price = int(result[0]), int(result[1]), float(result[2])
                if item_id <= 0 or quantity <= 0 or price < 0:
                    raise ValueError

                # now check the item_id exist, and price is the same
                # and quantity is available
                sql_2 = """
                    SELECT price, stock_number, status, name
                    FROM item
                    WHERE item_id = ?
                """

                sql_2_param = (item_id,)
                cur.execute(sql_2, sql_2_param)
                sql_2_result = cur.fetchone()

                # check the item does not exist
                if not sql_2_result:
                    response = {
                        'item_id': item_id,
                    }
                    return 409, response 

                # this item is removed from shelf
                if sql_2_result['status'] == 0:
                    response = {
                        'item_id': item_id,
                        'name': sql_2_result['name'],
                    }
                    return 410, response

                # not enough stock
                if sql_2_result["stock_number"] < quantity:
                    response = {
                        'item_id': item_id,
                        'available_stock': sql_2_result["stock_number"], 
                        'name': sql_2_result['name'],
                    }                
                    return 411, response 

                # incorrect unit price
                if sql_2_result['price'] != price:
                    response = {
                        "item_id": item_id,
                        "price": sql_2_result["price"],
                        "name": sql_2_result['name'],
                    }
                    return 414, response
                
                # update the total order price
                order_total_price += quantity * price

    except KeyError as e:
        print(e) 
        return 400, "Missing parameters in key 'items'"
    except ValueError as e:
        print(e)
        return 400, "Item id & quantity must be positive integer, and price must be float"    
    except Exception as e:
        print(e)
        return 500, "Internal server error"
    

    # check the total price
    total_price = round(total_price, 2)

    if total_price != round(order_total_price, 2):
        response = {
            'total_price': round(order_total_price, 2)
        }
        return 413, response 
    
    
    # submit the order
    try:
        with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
            cur = conn.cursor()

            sql_3 = """
                INSERT INTO orders(user_id, unix_time, total_price, address_id, notes, card_last_four)
                VALUES(?, ?, ?, ?, ?, ?)
            """

            sql_3_param = (
                identity["user_id"], 
                int(time.time()), 
                total_price, 
                address_id, 
                notes, 
                card_last_four
            )

            cur.execute(sql_3, sql_3_param)
            new_order_id = cur.lastrowid

            # insert all items
            # also update the item stock number
            sql_4 = """
                INSERT INTO order_item(ord_id, item_id, quantity, price, snapshot)
                VALUES(?, ?, ?, ?, ?)
            """

            sql_5 = """
                UPDATE item
                SET stock_number = stock_number - ?
                WHERE item_id = ?
            """

            for item in items:
                # get this item snapshot
                profile_list = []
                profile_list.append(item)

                snapshot = get_all_profiles(profile_list)[0]

                sql_4_param = (
                    new_order_id, 
                    item['item_id'],
                    item['quantity'],
                    item['price'],
                    json.dumps(snapshot),
                )

                sql_5_param = (
                    item['quantity'], 
                    item['item_id'],
                )

                cur.execute(sql_4, sql_4_param)
                cur.execute(sql_5, sql_5_param)
        
            # success
            response = {
                'ord_id': new_order_id,
                'total_price': total_price 
            }

            return 200, response  

    except Exception as e:
        print(e)
        print(type(e))
        return 500, "Internal server error"

