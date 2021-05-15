from flask_restx import Namespace, Resource, fields 
import models
import time
from datetime import datetime
from datetime import timedelta
from dateutil.relativedelta import relativedelta
from copy import deepcopy
import sqlite3
import os
from flask import request, abort
from utils.token import Token

api = Namespace(
    'sales',
    description="Admin check sales report. And the public can view the best sell 20 items."
)


def move_forward(graph_type):
    if graph_type == "day":
        return timedelta(days=1)
    elif graph_type == "week":
        return timedelta(weeks=1)
    elif graph_type == "month":
        return relativedelta(months=1)
    else:
        raise ValueError("Incorrect type {}".format(graph_type))


def filter_start_and_end(start_str, end_str):
    try:
        # convert string to datetime object
        start_range = datetime.strptime(start_str, "%Y-%m-%d")
        end_range = datetime.strptime(end_str, "%Y-%m-%d")
        return start_range, end_range
    except ValueError:
        abort("400", "Invalid format of input date string")


@api.route('')
class Sales(Resource):
    @api.response(200,"OK")
    @api.response(204, "No sale records")
    @api.response(400,"Invalid parameter")
    @api.response(403, "No authorization token / token invalid / token expired / not admin")
    @api.expect(models.sale_filter, models.token_header)
    @api.doc(description="Admin view sales data, require both start and end date.")
    def get(self):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
                return "No authorization", 403
        
        T = Token()
        identity = T.check(auth_header)

        if (not identity) or (identity['role'] != 0):
           return "Wrong token", 403


        # check the start and end time, both need to exist
        start_str = request.args.get("start", None)
        end_str = request.args.get("end", None)

        if (not start_str) or (not end_str):
            return "Require both start and end", 400

        start_range, end_range = filter_start_and_end(start_str, end_str)

        # check the start and end date
        FIRST_DAY, _ = filter_start_and_end("2021-01-01", "2021-01-01")
        END_DAY = datetime.now()

        if start_range > end_range or start_range < FIRST_DAY or end_range > END_DAY:
            return "Invalid time range", 400

        # now convert the end time to one day after
        end_range += timedelta(days=1) + timedelta(microseconds=1)

        # check the type, default is "day"
        graph_type = request.args.get("type", "day")
        typelist=['day','week','month']
        
        if graph_type not in typelist:
            return "Invalid parameter type", 400

        
        sql_1 = """
            SELECT COUNT(ord_id) AS count, SUM(total_price) as value
            FROM orders
            WHERE unix_time >= ? 
            AND unix_time <= ?
        """

        sql_2 = """
            SELECT orders.user_id,ROUND(SUM(orders.total_price), 2) AS total_price, user.first_name || ' ' || user.last_name AS name
            FROM orders, user
            WHERE unix_time >= ? 
            AND unix_time <= ?
            AND orders.user_id = user.user_id
            GROUP BY orders.user_id 
            ORDER BY sum(total_price) DESC
        """

        sql_3 = """
            SELECT order_item.item_id, SUM(order_item.quantity) AS amount, item.name
            FROM order_item, orders, item 
            WHERE  order_item.ord_id = orders.ord_id 
            AND orders.unix_time >= ?
            AND orders.unix_time <= ?
            AND order_item.item_id = item.item_id
            GROUP BY order_item.item_id
            ORDER BY amount DESC
        """

        values=(start_range.timestamp(), end_range.timestamp())
        result = {}


        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()
                
                # all orders and each total price
                cur.execute(sql_1, values)
                result_1 = cur.fetchone()

                if not result_1:
                    return "No Records", 204

                # simple attribute
                result["orders"] = result_1['count']

                turnover = 0

                if result['orders'] != 0:
                    turnover = round(result_1['value'], 2)

                result["turnover"] = round(turnover, 2)
                result['gst'] = round(turnover * (1 - 1 / 1.1), 2)
                result['revenue'] = round(turnover * 0.2, 2)


                # customer id list, with sum of order prices
                # first graph, plot customer shopping record bar chart
                cur.execute(sql_2,values)
                result_2 = cur.fetchall()

                result['graphs'] = {}
                result['graphs']['customers'] = result_2


                # second graph, plot of items sale amount
                cur.execute(sql_3, values)
                result_3 = cur.fetchall()
                result['graphs']['items'] = result_3
                

                # the third graph: sale orders & order count VS time in types
                orders_vs_time_list = []        

                # within the given time range, there are many periods
                # deepcopy the start
                # the end time is the start time minus 1 seconds
                result['type'] = graph_type
                p_start = deepcopy(start_range)
                p_end = deepcopy(start_range) - timedelta(microseconds=1)
                is_first_period = True

                while True:
                    p_summary = {
                        "x": p_start.strftime("%Y-%m-%d"),
                        "value": None,
                        "count": None
                    }

                    if is_first_period:
                        # first period, edit the date to the real start of range
                        if graph_type == "week":
                            print(p_start.weekday())
                            p_start -= timedelta(days=p_start.weekday())
                        elif graph_type == "month":
                            print(p_start.day)
                            p_start -= timedelta(days=(p_start.day-1))
                    
                        is_first_period = False   
                    
                    # for the end time
                    p_end = deepcopy(p_start) + move_forward(graph_type)
                    
                    # search sum of orders, and values within this period
                    param = (p_start.timestamp(), p_end.timestamp())
                    cur.execute(sql_1, param)
                    p_result = cur.fetchone()

                    if p_result['count'] == 0:
                        p_summary['value'] = 0
                        p_summary['count'] = 0
                    else:
                        p_summary['value'] = round(p_result['value'], 2)
                        p_summary['count'] = p_result['count']

                    # insert
                    orders_vs_time_list.append(p_summary)

                    if p_end > end_range:
                        break
                    else:
                        # move forward p_start
                        p_start += move_forward(graph_type)


                # results for last graph
                result['graphs']['orders'] = orders_vs_time_list
                
                return result, 200
                
        except Exception as e:
            print(e)
            return "Internal server error", 500

    