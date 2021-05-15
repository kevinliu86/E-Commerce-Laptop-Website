from apis import api
from flask import request 
from flask_restx import fields, reqparse


# you can use fields.String(required=True) to emphasize the test
# but you can also check the parameters in the api itself
# both are fine
login = api.model('login', {
    'email': fields.String,
    'password': fields.String
})


token = api.model('token', {
    'token': fields.String,
    'role': fields.Integer
})


address = api.model('address', {
    'unit_number': fields.Integer,
    'street_number': fields.Integer,
    'street_name': fields.String,
    'suburb': fields.String,
    'postcode': fields.String,
    'state': fields.String
})


signup = api.model('signup', {
    'first_name': fields.String,
    'last_name': fields.String,
    'email': fields.String,
    'mobile': fields.String,
    'password': fields.String,
    'address': fields.Nested(address)
})


# authorization token model
token_header = reqparse.RequestParser()
token_header.add_argument(
    'Authorization',
    type=str,
    help="Authorization token in bearer format",
    location="headers"
)

# profile model
# full for GET profile
profile_full = api.model('profile_full',{
    'first_name': fields.String,
    'last_name': fields.String,
    'email': fields.String,
    'mobile': fields.String,
    'password': fields.String,
    'address': fields.List(fields.Nested(address))
})

# list of profiles, for admin use
profile_full_list = api.model('profile_full_list', {
    'users': fields.List(fields.Nested(profile_full))
})


# simple for PUT profile (since the address is PUT separately)
profile_simple = api.model("profile_simple", {
    'first_name': fields.String,
    'last_name': fields.String,
    'email': fields.String,
    'mobile': fields.String,
    'password': fields.String
})

# address
address_parser = reqparse.RequestParser()
address_parser.add_argument(
    'address_id',
    type=int,
    help="user address_id",
    location="args"
)

# rating
rating = api.model('rating', {
    'Rating': fields.Integer,
})

my_rating_single_item = api.model('my_rating_single_item', {
    'item_id': fields.Integer,
    'item_name': fields.String,
    'photo': fields.String,
    'rating': fields.Integer,
})

my_rating = api.model('my_rating', {
    "all": fields.List(fields.Nested(my_rating_single_item))
})


# when sending an order, we use id to identify
order_item = api.model('order_item', {
    'item_id': fields.Integer,
    'quantity': fields.Integer,
    'price': fields.Float
})


order = api.model('order', {
    'address_id': fields.Integer,
    'notes': fields.String,
    'card_last_four': fields.String,
    'total_price': fields.Float,
    'items': fields.List(fields.Nested(order_item))
})

# order error: invalid item
order_error_invalid_item = api.model('order_error_invalid_item', {
    'item_id': fields.Integer
})

# order error: removed from shelf
order_error_removed = api.model('order_error_removed', {
    'item_id': fields.Integer,
    'name': fields.String
})

# maybe no stock, or the order quantity is too large
order_error_not_enough_stock = api.model('order_error_not_enough_stock', {
    'item_id': fields.Integer,
    'available_stock': fields.Integer,
    'name': fields.String
})

order_error_incorrect_price = api.model('order_error_incorrect_price', {
    'item_id': fields.Integer,
    'price': fields.Float,
    'name': fields.String    
})

order_error_wrong_total_price = api.model('order_error_wrong_total_price', {
    'total_price': fields.Float 
})


order_success = api.model('order_success', {
    'ord_id': fields.Integer,
    'total_price': fields.Float 
})


# for the order history, we return names instead of id
order_history_item = api.model('order_history_item',{
    'item_id': fields.Integer,
    'price': fields.Float,
    'quantity': fields.Integer,
    'snapshot': fields.String,      # the snapshot contains all the profile 
})


order_history = api.model('order_history', {
    'address': fields.Nested(address),
    'notes': fields.String,
    'card_last_four': fields.String,
    'total_price': fields.String,
    'time': fields.Integer,     # time in seconds since epoch
    'tracking': fields.String,
    'items': fields.List(fields.Nested(order_history_item))
})

order_history_list = api.model('order_history_list', {
    'orders': fields.List(fields.Nested(order_history))
})

all_orders_history_list = api.model('all_orders_history_list', {
    'new': fields.List(fields.Nested(order_history)),
    'old': fields.List(fields.Nested(order_history)),
})

# item module
# the data contains two keys: simple and detail
item_simple_profile = api.model('item_simple_profile', {
    'item_id': fields.Integer,
    'name': fields.String,
    'price': fields.Float,
    'stock_number': fields.Integer,
    'status': fields.Integer,
    'warranty': fields.String,
    'view': fields.Integer,
    'thumbnail': fields.String
})

item_detail_profile = api.model('item_detail_profile', {
    'many_many_attributes': fields.String,
    'many_many_attributes': fields.String
})

item_profile = api.model('item_profile',{
    'simple': fields.Nested(item_simple_profile),
    'detail': fields.Nested(item_detail_profile),
    'photos': fields.List(fields.String)
})

item_profile_list = api.model('item_profile_list', {
    'current_page': fields.Integer,
    'page_total': fields.Integer,
    'data': fields.List(fields.Nested(item_profile))
})


# admin update the model
item_profile_update = api.model('item_update', {
    'attributeA': fields.String,
    'attributeB': fields.String,
    'attributeC': fields.String,
    'many_many_attributes': fields.String,
    'photos': fields.List(fields.String),
})


# admin upload a new model
new_item = api.model('new_item', {
    "name": fields.String,
    "price": fields.String,
    "stock_number": fields.String,
    "status": fields.String,
    "warranty": fields.String,
    "thumbnail": fields.String,
    'other_attribute': fields.String,
    'other_other_attribute': fields.String,
    'photos': fields.List(fields.String),
})


# after admin upload, return a new item id
new_item_id = api.model('new_item_id', {
    "item_id": fields.Integer,
})


# when the customer browsing the webpage
# there are some filters to add, but they are optional
filter_item = api.model('filter_item', {
    "order_method": fields.String,  # view, name, price, (single choice only)
    "order": fields.String,         # asc, desc          (single choice only)
    "price_min": fields.Float,      
    "price_max": fields.Float,  
    "cpu": fields.List(fields.String),           # only two options: Intel, Amd  (multiple choice)
    "storage_size": fields.List(fields.String),  # <= 256, 256 to 512, 512 to 1T, 1T upwards (multiple choice)
    "memory_size": fields.List(fields.String),   # <= 8, 8 to 16, 16 upwards  (multiple choice)
    "graphic_model": fields.List(fields.String), # RTX 10 series, RTX 20 series, RTX 30 series, Intel core graphics, Radeon graphics, Quadro graphics (multiple choice)
    "screen_size": fields.List(fields.String),  # < 13.3, 13.3 to 15.6, 15.6 to 17.3 17.3 upwards (multiple choice)
    "keyword": fields.String,                     # keyword
});


# filter item: we provide filters among many ways
filter = reqparse.RequestParser()

filter.add_argument("page_size", type=int, help="items per page, the default value = 18", location="args")
filter.add_argument("price_min", type=float, location="args")
filter.add_argument("price_max", type=float, location="args")
filter.add_argument("cpu", type=int, help="0=Intel, 1=Amd (multiple choice)", action="append", location="args")
filter.add_argument("keyword", type=str, help="string, use %20 to replace the space", location="args")

filter.add_argument(
    "order_method", type=str, 
    help="view, name, price, or relevancy (single choice only, for keyword search, please use relevancy by default)", 
    location="args"
)

filter.add_argument(
    "order", type=str, 
    help="asc, desc, (single choice only, can be omit when using keyword search)", 
    location="args"
)

filter.add_argument(
    "storage", type=int, 
    help="0: <= 256GB, 1: from 256 <= 512 GB, 2: from 512 <= 1TB, 3: 1TB up (multiple choice)", 
    action="append", location="args"
)

filter.add_argument(
    "memory", type=int, 
    help="0: <= 8GB, 1: 8GB to <=16GB, 2: 16 GB up (multiple choice)", 
    action="append", location="args"
)

filter.add_argument(
    "graphic", type=int, 
    help="0: RTX 10 series, 1: RTX 20 series, 2: RTX 30 series (multiple choice)",
    action="append", location="args"
)

filter.add_argument(
    "screen", type=int,
    help="0: <= 13.3, 1: from 13.3 to 15.6, 2: 15.6  up (multiple choice)", 
    action="append", location="args"
)

filter.add_argument(
    "status", type=int,
    help="0: deleted items, 1: on sell items, 2: all items. Only admin can access to deleted items. Require the token to verify the identity.",
    location="args",
)


# banner for the front page
banner = api.model('banner', {
    "item_id": fields.Integer,
    "name": fields.String,
    "photo": fields.String,
})

banners = api.model('banners', {
    "banners": fields.List(fields.Nested(banner))
})


tracking = api.model('tracking', {
    'tracking': fields.String,
})


#filter sales
sale_filter = reqparse.RequestParser()

sale_filter.add_argument(
    "start", 
    type=int, 
    help="time in format yyyy-mm-dd, min value = 2021-01-01, max value is today's date", 
    location="args"
)

sale_filter.add_argument(
    "end", 
    type=int, 
    help="time in format yyyy-mm-dd, min value = 2021-01-01, max value is today's date", 
    location="args"
)

sale_filter.add_argument("type", type=str, help="day / week / month", location="args")
