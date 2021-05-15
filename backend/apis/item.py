from flask_restx import Namespace, Resource, fields
from flask import request, abort
import sqlite3 
import os
import models
import time 
from textdistance import jaro_winkler
from utils.token import Token
from utils.attributes import simple_attributes, detail_attributes
from utils.function import unpack


api = Namespace(
    'item',
    description="This module supports getting item information and filtering items. It also supports the admin to upload new item or delelte/undelete/edit existing items"
)


# given a item id list, return all profiles
def get_all_profiles(item_id_list):
    result = []
    
    try:
        with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
            conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
            cur = conn.cursor()

            for each in item_id_list:
                item_id = each['item_id']

                # select simple, detail and photos, same as below    
                sql_1 = """SELECT * FROM item WHERE item_id = ?"""
                sql_2 = """SELECT * FROM laptop WHERE item_id = ?"""
                sql_3 = """SELECT * FROM photo WHERE item_id = ?"""
                param = (item_id,)

                cur.execute(sql_1, param)
                simple = cur.fetchone()

                cur.execute(sql_2, param)
                detail = cur.fetchone()

                cur.execute(sql_3, param)
                raw_photos = cur.fetchall()
                photos = []
                for each_tuple in raw_photos:
                    photos.append(each_tuple['photo'])

                item_result = {
                    'simple': simple, 
                    'detail': detail, 
                    'photos': photos
                }

                result.append(item_result)
            
            return result

    except Exception as e:
        print(e)
        abort(500, "Internal server error")


def get_page_count(total, item_per_page):
    return (total + item_per_page - 1) // item_per_page


# the page_id must be positive, usually around max 10 pages
def filter_page_id(page_id):
    if not page_id:
        abort(400, "No page_id")
    
    try:
        page_id = int(page_id)
    except ValueError:
        abort(400, "Invalid page_id")

    if page_id < 0:
        abort(400, "Invalid page_id")
    
    return page_id


def  filter_page_size(page_size, default_value):
    if not page_size:
        return default_value
    
    try:
        page_size = int(page_size)
    except ValueError:
        abort(400, "Invalid page_size")
    
    if page_size <= 0:
        abort(400, "Invalid page_size")
    
    return page_size 



def filter_price(price, default_price):
    if price is None:
        return default_price

    try:
        price_2 = float(price)
    except ValueError:
        abort(400, "Price is not a float")

    if price_2 < 0:
        abort(400, "Invalid price < 0")
    
    return price_2


def filter_param(param, default_list):
    if param is not None:
        param = list(set(param))
        param = [i for i in param if i in default_list]

    return param 


def configure_conds(params, conds):
    if (params is None) or (len(params) == 0):
        return None
    
    result = "({}".format(conds[int(params[0])])

    for i in params[1:]:
        result += " OR {}".format(conds[int(i)])
    
    result += ")"

    return result


def check_admin_identity():
    # check token
    auth=request.headers.get("Authorization")
    if not auth:
        return None, "No authorization token", 403
    
    T = Token()
    identity = T.check(auth)

    if not identity:
        return None, "Wrong token", 403

    if identity['role'] != 0:
        return None, "Only admin can edit", 403

    return identity, None, None


def check_item_id(item_id):
    # check item_id
    if not item_id:
        return None, "No item_id provided", 400
    
    try:
        item_id = int(item_id)
    except ValueError:
        return None, "Item_id must be an integer", 400 
    
    if item_id <= 0:
        return None, "Item_id must be a positive integer", 400 

    return item_id, None, None 



@api.route('/id/<item_id>')
class Item_with_id(Resource):
    @api.response(200, "OK", models.item_profile)
    @api.response(404, "Not found")
    @api.response(400, "Invalid item_id: item_id must be a positive integer / item_id not provided.")
    @api.expect(models.token_header)
    @api.doc(description="""
        Everyone can view the details of the item. No need to provide token.
        But for logged in user, the token can be used to store the view history. 
        status = 1 for available product. status = 0 means the product is deleted, and no longer for sale.
        Everyone can view the deleted items. But usually the customer will not be directed to deleted items.  
    """)
    def get(self, item_id):
        if not item_id:
            return "No item_id provided", 400
        
        try:
            item_id = int(item_id)
        except ValueError:
            return "Item_id must be an integer", 400 
        
        if item_id <= 0:
            return "Item_id must be a positive integer", 400 
        
        # check the existence, if yes, then query both tables
        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()

                sql_1 = "SELECT * FROM item WHERE item_id = ?"
                sql_2 = "SELECT * FROM laptop WHERE item_id = ?"
                sql_3 = "SELECT * FROM photo WHERE item_id = ?"
                sql_4 = "Update item SET view = view + 1 WHERE item_id = ?"
                
                sql_param = (item_id,)

                cur.execute(sql_1, sql_param)

                simple_profile = cur.fetchone()

                if not simple_profile:
                    return "Not found", 404 
                
                cur.execute(sql_2, sql_param)
                detail_profile = cur.fetchone()

                cur.execute(sql_3, sql_param)
                raw_photos = cur.fetchall()

                cur.execute(sql_4, sql_param)

                photos = []

                for each in raw_photos:
                    photos.append(each['photo'])

                result = {
                    'simple': simple_profile, 
                    'detail': detail_profile, 
                    'photos': photos
                }

                # before return, check the token header
                header = request.headers.get("Authorization")
                
                # if exist, check the role
                if header:
                    T = Token()
                    identity = T.check(header)

                    if identity['role'] == 1:
                        # for logged in user, store in the view history
                        sql_4 = "INSERT INTO view_history(user_id, item_id, time) VALUES (?, ?, ?)"
                        sql_4_param = (identity['user_id'], item_id, time.time())
                        
                        cur.execute(sql_4, sql_4_param)

                # return result
                return result, 200

        except Exception as e:
            print(e)
            return "Internal server error", 500              


@api.route('/search/<page_id>')
class Search(Resource):
    @api.response(200, "OK", models.item_profile_list)
    @api.response(500, "Internal server error")
    @api.response(400, "Malformed request")
    @api.expect(models.filter, models.token_header)
    @api.doc(description="""
        We provide an extensive search method for the user to filter items and obtain what he wishes to see. 
        Filters include: order, price, cpu model, memory size, storage size, graphic model, screen size, 
        and keyword search. These filters have a specified range of values, for simplicity, we will ignore all invalid values,
        and replace with our default values to carry on. 
        Currently we have around 240 computers in the dataset. 
        Default page_size = 18. 
    """)
    def get(self, page_id):
        # deal with the page_id, page_size first
        page_id = filter_page_id(page_id)

        # deal with all values
        page_size = filter_page_size(request.args.get("page_size"), 18)

        order_method = "view"
        if request.args.get("order_method") in ["view", "name", "price", "relevancy"]:
            order_method = request.args.get("order_method")
        
        order = "asc"
        if request.args.get("order") in ["asc", "desc"]:
            order = request.args.get("order")
        
        price_min = filter_price(request.args.get("price_min"), 0)
        price_max = filter_price(request.args.get("price_max"), 10000)

        if price_max < price_min:
            abort(400, "Price max should > price min")

        # variable to store all conditions
        conds = []
        conds.append("(item.price >= {} AND item.price <= {})".format(price_min, price_max))

        # keyword search, may be empty
        # when it is the keyword search, default is order_method = relevancy and order = desc
        keyword = request.args.get("keyword")

        # multi-valued attributes
        cpu = filter_param(request.args.getlist("cpu"), ["0", "1"])
        storage = filter_param(request.args.getlist("storage"), ["0", "1", "2", "3"])
        memory = filter_param(request.args.getlist("memory"), ["0", "1", "2"])
        graphic = filter_param(request.args.getlist("graphic"), ["0", "1", "2"])
        screen = filter_param(request.args.getlist("screen"), ["0", "1", "2", "3"])

        cpu_conds = [
            "lower(laptop.cpu_prod) LIKE '%intel%'", 
            "lower(laptop.cpu_prod) LIKE '%amd%'",
        ]

        storage_conds = [
            "CAST(laptop.primary_storage_cap AS INTEGER) <= 256",
            "(CAST(laptop.primary_storage_cap AS INTEGER) > 256 AND CAST(laptop.primary_storage_cap AS INTEGER) <= 512)",
            "(CAST(laptop.primary_storage_cap AS INTEGER) > 512 AND CAST(laptop.primary_storage_cap AS INTEGER) <= 1024)",
            "CAST(laptop.primary_storage_cap AS INTEGER) > 1024",
        ]

        memory_conds = [
            "CAST(laptop.memory_size AS INTEGER) <= 8",
            "(CAST(laptop.memory_size AS INTEGER) > 8 AND CAST(laptop.memory_size AS INTEGER) <= 16)",
            "CAST(laptop.memory_size AS INTEGER) > 16",
        ]

        graphic_conds = [
            "laptop.gpu_model LIKE '%GTX 1%'",
            "laptop.gpu_model LIKE '%RTX 2%'",
            "laptop.gpu_model LIKE '%RTX 3%'",
        ]

        screen_conds = [
            "CAST(laptop.display_size AS REAL) <= 13.3",
            "(CAST(laptop.display_size AS REAL) > 13.3 AND CAST(laptop.display_size AS REAL) <= 15.6)",
            "CAST(laptop.display_size AS REAL) > 15.6",
        ]

            
        # for each variable list, if one condition, use AND to join, if multiple condition
        # bracket them, and inside use OR to join
        conds.append(configure_conds(cpu, cpu_conds))
        conds.append(configure_conds(storage, storage_conds))
        conds.append(configure_conds(memory, memory_conds))
        conds.append(configure_conds(graphic, graphic_conds))
        conds.append(configure_conds(screen, screen_conds))


        # at last, check the status = 0 / 1 / 2
        # default to on sell items
        status = 1

        if (request.args.get("status")):
            auth_header = request.headers.get("Authorization")
            if not auth_header:
                return "No authorization token exist when you try to access parameter 'status'", 403

            T = Token()
            identity = T.check(auth_header)

            if (not identity) or (identity['role'] != 0):
                return "Wrong token when you try to access parameter 'status'", 403

            status_list = ["0", "1", "2"]

            if request.args.get("status") not in status_list:
                return "Wrong status parameter", 400
            
            status = int(request.args.get("status"))
        
        
        # add condition for status
        if status == 0:
            conds.append("(item.status = 0)")
        elif status == 1:
            conds.append("(item.status = 1)")
        else:
            # all items
            conds.append("(status = 0 OR status = 1)")


        # remove all None
        conds = [cond for cond in conds if cond is not None]


        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()

                # get both item_id and name into the list
                sql = """SELECT item.item_id, item.name 
                    FROM item LEFT OUTER JOIN laptop 
                    ON item.item_id = laptop.item_id 
                """

                for cond in conds:
                    if "WHERE" in sql:
                        sql += "AND {} \n".format(cond)
                    else:
                        sql += "WHERE {} \n".format(cond)

                if order_method != "relevancy":
                    sql += "ORDER BY {} {}".format(order_method, order)

                cur.execute(sql)

                item_id_name_list = cur.fetchall()

                # if no result, or the id list does not reach this page id
                # here cannot use abort, it will be caught in the exception
                if (not item_id_name_list) or (len(item_id_name_list) < page_id * page_size):
                    return(404, "No more pages")        


                # if there is a keyword in the request, then we fetch all item names and compare
                # the keyword will not have %20 inside
                result_id_list = item_id_name_list
                
                if keyword:
                    keyword = keyword.lower()

                    for item in item_id_name_list:
                        name = item['name'].lower()
                        item['similarity'] = jaro_winkler.normalized_similarity(keyword, name)

                    # if the keyword search asks for order by similarity
                    # use descending order by default
                    if order_method == "relevancy":
                        item_id_name_list = sorted(
                            item_id_name_list, 
                            key= lambda d: d['similarity'],
                            reverse=True
                        )

                    # threshold = 0.65
                    THRESHOLD = 0.65
                    result_id_list = [d for d in item_id_name_list if d['similarity'] > THRESHOLD]


                # again, check if no results
                if (not result_id_list) or (len(result_id_list) < page_id * page_size):
                    return(404, "No more pages")        


                # pack the result
                result = {
                    'current_page': page_id,
                    'page_count': get_page_count(len(result_id_list), page_size),
                    'data': get_all_profiles(result_id_list[page_id * page_size : (page_id+1) * page_size])
                }

                return result, 200 

        except Exception as e:
            print(e)
            abort(500, "Internal server error")     



@api.route('/<item_id>')
class Item(Resource):
    @api.response(200, "OK")
    @api.response(400, "Invalid attribute / item_id")
    @api.response(403, "No authorization token / token invalid / token expired / not admin")
    @api.response(404, "Item id not found")
    @api.response(500, "Internal server error")
    @api.expect(models.token_header, models.item_profile_update)
    @api.doc("""
        Admin update the item info. 
        The admin is free to update everything from price, stock to the computer specifications.
        Attach all photos when photos are editted. 
    """)
    def put(self, item_id):
        """Only admin can edit"""

        identity, msg, code = check_admin_identity()
        item_id, msg2, code2 = check_item_id(item_id)

        if not identity:
            return msg, code

        if not item_id:
            return msg2, code2

        # now unpack the data to json
        data = request.json
        if not data:
            return "Malformed request", 400
        
        print(data)

        # sql part
        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()

                # first check the existence of the item_id
                sql_1 = "SELECT * FROM item WHERE item_id = ?"
                param_1 = (item_id,)


                cur.execute(sql_1, param_1)
                is_exist = cur.fetchone()

                if not is_exist:
                    return "Item_id not found", 404

                # scan all attributes, make sure all keys are ok
                for key in data:
                    if key not in simple_attributes and key not in detail_attributes and key != "photos":
                        return "Invalid attribute {}".format(key), 400


                # if photo is in the data
                # check the validity: require at least one photo
                if "photos" in data:           
                    if not (type(data['photos']) is list):
                        return "The photos value must be a list", 400
                    
                    if len(data['photos']) == 0:
                        return "Need to provide at least one photo", 400              


                # now update the simple profile first
                for key in data:
                    sql_2 = None 
                    if key in simple_attributes:
                        sql_2 = "UPDATE item SET {} = ? WHERE item_id = ?".format(key)
                    elif key in detail_attributes:
                        sql_2 = "UPDATE laptop SET {} = ? WHERE item_id = ?".format(key)
                    
                    if sql_2 is not None:
                        param_2 = (data[key], item_id)
                        cur.execute(sql_2, param_2)


                # now update the photo, if exist
                if "photos" in data:
                    # remove all existing photos
                    sql_3 = "DELETE FROM photo WHERE item_id = {}".format(item_id)
                    cur.execute(sql_3)

                    # insert all photos into it
                    for src in data['photos']:
                        sql_4 = "INSERT INTO photo(item_id, photo) VALUES (?, ?)"
                        param_4 = (item_id, src)
                        cur.execute(sql_4, param_4)


                return "OK", 200

        except Exception as e:
            print(e)
            return "Internal server error", 500



@api.route('/delete/<item_id>')
@api.route('/undelete/<item_id>')
class Status(Resource):
    @api.response(200, "OK")
    @api.response(400, "Invalid item_id")
    @api.response(403, "No authorization token / token invalid / token expired / not admin")
    @api.response(404, "Item id not found / The item is deleted already / The item is active already")
    @api.response(500, "Internal server error")
    @api.expect(models.token_header)
    @api.doc("""
        Admin can either delete or undelete an item. Admin token required. 
    """)
    def put(self, item_id):
        """Only admin can undelete"""

        identity, msg, code = check_admin_identity()
        item_id, msg2, code2 = check_item_id(item_id)

        if not identity:
            return msg, code

        if not item_id:
            return msg2, code2

        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()

                # check the existence and status of the item
                sql_1 = "SELECT status FROM item WHERE item_id = ?"
                param_1 = (item_id,)

                cur.execute(sql_1, param_1)
                result = cur.fetchone()

                if not result:
                    return "Item_id not found", 404
                
                # separate consider delete and undelete
                # consider undelete first, since the substring 'delete' is also in 'undelete' 
                if "undelete" in request.path:
                    if result['status'] == 1:
                        return "The item is active already", 404
                    
                    print("hello")
                    sql_2 = "UPDATE item SET status = 1 WHERE item_id = ?"
                    param_2 = (item_id,)
                    cur.execute(sql_2, param_2)

                else: # delete
                    if result['status'] == 0:
                        return "The item is deleted already", 404

                    sql_2 = "UPDATE item SET status = 0 WHERE item_id = ?"
                    param_2 = (item_id,)
                    cur.execute(sql_2, param_2)

                return "OK", 200

        except Exception as e:
            print(e)
            return "Internal server error", 500        


@api.route('')
class NewItem(Resource):
    @api.response(200, "OK", models.new_item_id)
    @api.response(400, "Invalid attribute / No photos provided")
    @api.response(500, "Internal server error")
    @api.response(403, "No authorization token / token invalid / token expired / not admin")
    @api.expect(models.token_header, models.new_item)
    @api.doc(description="""
        The admin can upload a new item.
        The admin must provide all attributs in ["name", "price", "stock_number", "status", "warranty"].
        The thumbnail will be set as null, if not given for now
        The status can set to be 1 for on shelf right now, or 0 to wait for further data. 
        For other attributes, can leave for blank, or input some values. 
    """)
    def post(self):
        """Only admin can upload"""

        identity, msg, code = check_admin_identity()
        if not identity:
            return msg, code

        data = request.json
        if not data:
            return "No data", 400

        # scan all attributes, make sure all keys are ok
        for key in data:
            if key not in simple_attributes and key not in detail_attributes and key != "photos":
                return "Invalid attribute {}".format(key), 400

        # simple_attributes must be fullfilled
        # the thumbnail can be empty for now
        success, unpack_result = unpack(
            data, 
            "name", "price", "stock_number", "status",
        )

        if not success:
            return "Simple attributes must be fullfilled (you can leave thumbnail for now)", 400


        # the admin must upload at least one photo
        if "photos" not in data:
            return "No photos provided", 400
        
        if not (type(data['photos']) is list):
            return "The photos value must be a list", 400
        
        if len(data['photos']) == 0:
            return "Need to provide at least one photo", 400

        print(data)

        # sql part
        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()

                # insert simple profile and get id
                # view starts from 0
                sql_1 = """
                    INSERT INTO item(name, price, stock_number, status, view)
                    VALUES (?, ?, ?, ?, 0)
                """

                param_1 = tuple(unpack_result)

                cur.execute(sql_1, param_1)
                new_item_id = cur.lastrowid

                # now insert a row into the table "laptop"
                sql_2 = "INSERT INTO laptop(item_id) VALUES (?)"
                param_2 = (new_item_id,)
                cur.execute(sql_2, param_2)

                # now insert for all detail attributes
                for key in data:
                    if key in detail_attributes:
                        sql_3 = "UPDATE laptop SET {} = ? WHERE item_id = ?".format(key)
                        param_3 = (data[key], new_item_id)
                        cur.execute(sql_3, param_3)
                

                # insert all photos
                for src in data['photos']:
                    sql_4 = "INSERT INTO photo(item_id, photo) VALUES (?, ?)"
                    param_4 = (new_item_id, src)
                    cur.execute(sql_4, param_4)

                
                # after insertion, return the id
                result = {
                    "item_id": new_item_id,
                }

                return result, 200

        except Exception as e:
            print(e)
            return "Internal server error", 500


@api.route('/empty')
class NewItem(Resource):
    @api.response(200, "OK", models.item_profile)
    @api.response(403, "No authorization token / token invalid / token expired / not admin")
    @api.expect(models.token_header)
    @api.doc(description="""
        Before the admin creates an item, the backend returns the newest set of specification to the admin.
        And the admin will fill all fields. 
    """)
    def get(self):
        """Only admin can use this method"""

        identity, msg, code = check_admin_identity()
        if not identity:
            return msg, code

        # use the simple_attribute and detail_attribute
        result = {
            "simple": {key : None for key in simple_attributes},
            "detail": {key : None for key in detail_attributes},
            "photos": []
        }

        return result, 200 


