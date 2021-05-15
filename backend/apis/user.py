from flask_restx import Namespace, Resource, fields
from flask import request, abort
import sqlite3 
import os 

import models
from utils.token import Token
from utils.function import unpack
from utils.function import check_address, check_mobile, check_name, check_password, check_email
from .item import get_all_profiles

api = Namespace(
    'user',
    description="User profile actions, including view history"
)


def get_user_profile(user_id):
    sql1 = """
        SELECT user_id, first_name, last_name, email, mobile
        FROM user
        WHERE user_id = ?
    """
    
    #  address only return the valid ones
    sql2 = """
        SELECT address_id, unit_number, street_number, street_name, suburb, state, postcode
        FROM customer_address
        WHERE user_id = ? AND status == 1
    """

    sql_param = (user_id,)

    try:
        with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
            conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}

            cur1 = conn.cursor()
            cur2 = conn.cursor()
            
            r1, r2 = cur1.execute(sql1, sql_param), cur2.execute(sql2, sql_param)
            
            result1 = r1.fetchone()
            result2 = r2.fetchall()

            if not result1:
                return None
            else:
                result1["address"] = result2
                return result1

    except Exception as e:
        print(e)
        abort(500)


@api.route('/profile')
class Profile(Resource):
    @api.response(200,"OK",models.profile_full)
    @api.response(403,"No authorization token / token invalid / token expired")
    @api.expect(models.token_header)
    @api.doc(description="The registered user can retrieve all profile sets.")
    def get(self):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return "No authorization token", 403

        T = Token()
        identity = T.check(auth_header)

        if not identity:
            return "Wrong token", 403
        
        result = get_user_profile(identity['user_id'])
        return result


    @api.response(200, "OK")
    @api.response(403, "No authorization token / token invalid / token expired")
    @api.response(400, "Malformed request / Wrong data format")
    @api.expect(models.token_header,models.profile_simple)
    @api.doc(description="""
        The user can update his/her profile. The user address is updated through PUT /user/address, not here. 
        Not all attributes need to be exist. Only the modified ones are required to send to the backend.
    """)
    def put(self):
        auth=request.headers.get("Authorization")
        if not auth:
            return "No authorization token",403
        
        T=Token()
        identity=T.check(auth)
        
        if not identity:
            return"Wrong token",403
        
        ids = identity['user_id']

        data=request.json
        
        if not data:
            return "Malformed request", 400
        
        is_unpack_ok, modified_data = unpack(
            data,
            "first_name","last_name","email","mobile","password",
            required=False
        )

        if not is_unpack_ok:
            return "Malformed request", 400
        
        f_name, l_name, email, mobile, password = modified_data

        # also prepare the sql for the relevant modified data
        # one data => one sql => one tuple in the sql_param_list
        sql_list = []
        sql_param_list = []
        
        if f_name:
            ok, msg = check_name(f_name)
            if not ok:
                return msg, 400
            
            sql_list.append("UPDATE user SET first_name = ? WHERE user_id = ?")
            sql_param_list.append((f_name, ids))


        if l_name:
            ok, msg = check_name(l_name)
            if not ok:
                return msg, 400

            sql_list.append("UPDATE user SET last_name = ? WHERE user_id = ?")
            sql_param_list.append((l_name, ids))       
            

        if email:
            ok, msg = check_email(email)
            if not ok:
                return msg, 400
            
            sql_list.append("UPDATE user SET email = ? WHERE user_id = ?")
            sql_param_list.append((email, ids))


        if mobile:
            ok, msg = check_mobile(mobile);
            if not ok:
                return msg, 400 
        
            sql_list.append("UPDATE user SET mobile = ? WHERE user_id = ?")
            sql_param_list.append((mobile, ids))


        if password:
            ok, msg = check_password(password)
            if not ok: 
                return msg, 400 

            sql_list.append("UPDATE user SET password = ? WHERE user_id = ?")
            sql_param_list.append((password, ids))

        
        # if nothing update, this is a malformed request
        if len(sql_list) == 0:
            return "Malformed request", 400

        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()

                for i in range(len(sql_list)):
                    cur.execute(sql_list[i], sql_param_list[i])

                return "OK", 200

        except Exception as e:
            print(e)
            return "Internal server error", 500


@api.route('/address')
class Address(Resource):
    @api.response(200, "OK", models.address)        # either a dict, or a list of dict
    @api.response(403, "No authorization token / token invalid / token expired")
    @api.response(404, "Invalid address_id")
    @api.expect(models.token_header, models.address_parser)
    @api.doc(description="The registered user can retrieve all address sets, or a specific address set. The admin can look at all addresses.")
    def get(self):
        # first check the auth token
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return "No authorization token", 403
        
        T = Token()
        identity = T.check(auth_header)
        if not identity:
            return "Wrong token", 403
        
        # check the address_id in query string, but this is optional
        address_id = None

        if request.args.get("address_id"):
            try:
                address_id = int(request.args.get("address_id"))
            except ValueError:
                return "Address_id should be integer", 400

            if address_id and address_id <= 0:
                return "Address_id should be positive", 400


        # sql
        sql = None 
        values = None 

        # if address_id exist
        if address_id:
            sql = """SELECT address_id, unit_number, street_number, street_name, suburb, state, postcode
                    FROM customer_address
                    WHERE user_id = ? and address_id = ?
            """

            values = (identity['user_id'],address_id)            

        else:
            # get all address for this user
            sql = """SELECT address_id, unit_number, street_number, street_name, suburb, state, postcode
                    FROM customer_address
                    WHERE user_id = ? AND status == 1
            """

            values = (identity['user_id'],)

        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()
                
                cur.execute(sql, values)
                result = cur.fetchall()

                # check if no result
                if not result:
                    return "Invalid address_id", 404
                else:
                    return result, 200 

        except Exception as e:
            print(e)
            return "Internal server error", 500


    @api.response(200, "OK")
    @api.response(403, "No authorization token / token invalid / token expired")
    @api.response(400, "Malformed request / Wrong data format")
    @api.expect(models.token_header, models.address)
    @api.doc(description="With the auth token, the user can register another set of address.")
    def post(self):
        # first check the auth token
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return "No authorization token", 403
        
        T = Token()
        identity = T.check(auth_header)
        if not identity:
            return "Wrong token", 403     

        # unpack the address
        data = request.json 
        if not data:
            return "Malformed request", 400
        
        success, result = unpack(
            data, 
            "unit_number", "street_number", "street_name", "suburb", "postcode", "state",
            required=True
        )

        if not success:
            return "Missing parameter in address", 400
        
        unitnumber, streetnumber, streetname, suburb, postcode, state = result

        # check all validity
        success, msg = check_address(
            unitnumber, streetnumber, streetname, suburb, postcode, state
        )

        if not success:
            return msg, 400 

        sql = """INSERT INTO customer_address(user_id, unit_number, street_number, street_name, suburb, state, postcode)
                VALUES(?, ?, ?, ?, ?, ?, ?)
        """

        values = (identity['user_id'], unitnumber, streetnumber, streetname, suburb, state, postcode)

        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()

                cur.execute(sql, values)
                new_address_id = cur.lastrowid
                
                return {"address_id": new_address_id}, 200
        
        except Exception as e:
            print(e)
            return "Internal server error", 500
    

    @api.response(200, "OK")
    @api.response(403, "No authorization token / token invalid / token expired")
    @api.response(400, "Malformed request / Wrong data format")
    @api.response(401, "Invalid address_id")
    @api.expect(models.token_header, models.address_parser, models.address)
    @api.doc(description="With the auth token, the user can update his own address sets, one per time. Require the whole set of address data, including not updated one")
    def put(self):
        # first check the auth token
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return "No authorization token", 403
        
        T = Token()
        identity = T.check(auth_header)
        if not identity:
            return "Wrong token", 403
        
        # require the address_id
        if not request.args.get("address_id"):
            return "Missing address_id", 400

        address_id = None

        try:
            address_id = int(request.args.get("address_id"))
        except ValueError:
            return "Address_id should be integer", 400

        if address_id and address_id <= 0:
            return "Address_id should be positive", 400

        # check if the token user has the address or not
        sql_1 = """
                SELECT * 
                FROM customer_address
                WHERE user_id = ? and address_id = ?
        """

        sql_1_param = (identity['user_id'], address_id)

        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()

                result = cur.execute(sql_1, sql_1_param)

                if not result:
                    return "Invalid address_id", 401

        except Exception as e:
            print(e)
            return "Internal server error", 500 


        # nwo unpack the address
        data = request.json 
        if not data:
            return "Malformed request", 400
        
        success, result = unpack(
            data, 
            "unit_number", "street_number", "street_name", "suburb", "postcode", "state",
            required=True
        )

        if not success:
            return "Missing parameter in address", 400
        
        unitnumber, streetnumber, streetname, suburb, postcode, state = result

        # check all validity
        success, msg = check_address(
            unitnumber, streetnumber, streetname, suburb, postcode, state
        )

        if not success:
            return msg, 400 

        # sql
        sql_2 = """
            UPDATE customer_address
            SET unit_number = ?, 
                street_number = ?,
                street_name = ?,
                suburb = ?,
                postcode = ?,
                state = ?
            WHERE user_id = ? AND address_id = ?
        """

        sql_2_param = (
            unitnumber, 
            streetnumber, 
            streetname, 
            suburb, 
            postcode, 
            state,
            identity['user_id'], 
            address_id
        )

        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()

                cur.execute(sql_2, sql_2_param)
                return "OK", 200
                
        except Exception as e:
            print(e)
            return "Internal server error", 500


    @api.response(200, "OK")
    @api.response(403, "No authorization token / token invalid / token expired")
    @api.response(400, "Malformed request / Wrong data format")
    @api.response(401, "Invalid address_id / The address is inactive")
    @api.response(402, "This is the last address set of this user.")
    @api.expect(models.token_header, models.address_parser)
    @api.doc(description="With the auth token, the user can remove one set of address. But cannot remove all of them. There must be one set left.")
    def delete(self):
        # first check the auth token
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return "No authorization token", 403
        
        T = Token()
        identity = T.check(auth_header)
        if not identity:
            return "Wrong token", 403
        
        # require the address_id
        if not request.args.get("address_id"):
            return "Missing address_id", 400

        address_id = None

        try:
            address_id = int(request.args.get("address_id"))
        except ValueError:
            return "Address_id should be integer", 400

        if address_id and address_id <= 0:
            return "Address_id should be positive", 400


        # several things:
        # 1. Check whether this address belongs to the user or not
        # 2. The address must be active (i.e. state = 1)
        # 3. The address should not be the last set of address of this user
        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()

                sql_1 = "SELECT status FROM customer_address WHERE user_id = ? AND address_id = ?"
                sql_1_param = (identity['user_id'], address_id)
                cur.execute(sql_1, sql_1_param)

                result_1 = cur.fetchone()

                if not result_1:
                    return "Invalid address_id", 401
                
                if result_1['status'] != 1:
                    return "address_id is deleted already", 401
                
                sql_2 = "SELECT count(*) AS num FROM customer_address WHERE user_id = ? AND status = 1"
                sql_2_param = (identity['user_id'],)
                cur.execute(sql_2, sql_2_param)

                result_2 = cur.fetchone()

                if int(result_2['num']) == 1:
                    return "This is the last address set of this user", 402
                
                # now change the status to 0
                sql_3 = "UPDATE customer_address SET status = 0 WHERE address_id = ?"
                sql_3_param = (address_id, )
                cur.execute(sql_3, sql_3_param)

                return "OK", 200 
                
        except Exception as e:
            print(e)
            return "Internal server error", 500


@api.route('/viewhistory')
class ViewHistory(Resource):
    @api.response(200, "ok")
    @api.response(403, "No authorization token / token invalid / token expired")
    @api.response(204, "No content")
    @api.expect(models.token_header)
    @api.doc(description="The registered user can retrieve the recent 8 view_history")
    def get(self):

        header = request.headers.get("Authorization")
        if not header:
            return "No authorization token", 403
        
        T = Token()
        identity = T.check(header)
        
        if not identity:
            return "Wrong Token", 403
        
        sql = """
            SELECT DISTINCT view_history.item_id 
            FROM view_history LEFT OUTER JOIN item ON view_history.item_id = item.item_id
            WHERE user_id= ? AND item.status = 1
            ORDER BY time DESC 
            LIMIT 8
        """
        
        parameter = (identity["user_id"],)

        try:
            with sqlite3.connect(os.environ.get("DB_FILE")) as conn:
                conn.row_factory = lambda C, R: {c[0]: R[i] for i, c in enumerate(C.description)}
                cur = conn.cursor()
                
                r = cur.execute(sql, parameter)
                result = r.fetchall()
                
                if len(result) == 0:
                    return "No content", 204
                else:
                    final = get_all_profiles(list(result))
                    return final, 200

        except Exception as e:
            print(e)
            return "Internal server error", 500

    