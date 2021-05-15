from flask import Flask 
from flask_cors import CORS
DB_FILE = "data.db"

from apis import api

# start the backend
app = Flask(__name__)
CORS(app)
app.url_map.strict_slashes = False 
api.init_app(app)


if __name__ == '__main__':
    app.run(debug=True)

