import os
from urllib.parse import urlencode

import jwt
import psycopg2
import psycopg2.errors
import psycopg2.extras
import requests
from flask import Flask, g, jsonify, redirect, request
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

from auth import create_token, require_auth
from mapbox import geocode_address, get_driving_route
from weather import check_weather

app = Flask(__name__)
CORS(app, origins=[os.environ.get("FRONTEND_URL", "http://localhost:5173")])

# Roadrunner Logistics depot — fixed origin point for all delivery routing.
DEPOT_LOCATION = {"lat": 35.0844, "lng": -106.6504}  # Albuquerque, NM

WEATHER_DELAY_BUFFER = 1.2  # +20% travel time when delay_risk is true

SAMPLE_DELIVERIES = [
    {"id": 1, "address": "123 Main St, Springfield", "status": "delivered"},
    {"id": 2, "address": "456 Oak Ave, Shelbyville", "status": "in_transit"},
    {"id": 3, "address": "789 Pine Rd, Capital City", "status": "pending"},
]

MENU_ITEMS = [
    {"id": 1, "name": "Roadrunner Burger", "description": "Grilled beef patty, cheddar, pickles, house sauce", "price": 9.50, "emoji": "🍔"},
    {"id": 2, "name": "Desert Veggie Wrap", "description": "Grilled vegetables, hummus, spinach tortilla", "price": 8.00, "emoji": "🌯"},
    {"id": 3, "name": "Canyon Chicken Bowl", "description": "Grilled chicken, rice, black beans, salsa", "price": 10.25, "emoji": "🍗"},
    {"id": 4, "name": "Mesa Margherita Pizza", "description": "Fresh mozzarella, basil, san marzano tomato", "price": 11.00, "emoji": "🍕"},
    {"id": 5, "name": "Sonic Boom Smoothie", "description": "Mango, banana, pineapple, oat milk", "price": 6.50, "emoji": "🥤"},
    {"id": 6, "name": "Speedy Churros", "description": "Cinnamon sugar churros, chocolate dip", "price": 5.00, "emoji": "🍩"},
]


def get_db_connection():
    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        port=os.environ.get("DB_PORT", "5432"),
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        dbname=os.environ["DB_NAME"],
    )


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/deliveries")
def list_deliveries():
    return jsonify(SAMPLE_DELIVERIES)


@app.post("/deliveries")
def create_delivery():
    data = request.get_json(silent=True) or {}
    address = data.get("address")
    status = data.get("status", "pending")

    if not address:
        return jsonify({"error": "address is required"}), 400

    conn = get_db_connection()
    try:
        with conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    INSERT INTO deliveries (address, status)
                    VALUES (%s, %s)
                    RETURNING id, address, status, created_at
                    """,
                    (address, status),
                )
                delivery = cur.fetchone()
    finally:
        conn.close()

    return jsonify(dict(delivery)), 201


@app.get("/menu")
def get_menu():
    return jsonify(MENU_ITEMS)


@app.post("/auth/signup")
def signup():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")
    name = (data.get("name") or "").strip()

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    password_hash = generate_password_hash(password)

    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            try:
                cur.execute(
                    """
                    INSERT INTO users (email, name, password_hash, auth_provider)
                    VALUES (%s, %s, %s, 'password')
                    RETURNING id, email, name
                    """,
                    (email, name, password_hash),
                )
                user = cur.fetchone()
                conn.commit()
            except psycopg2.errors.UniqueViolation:
                conn.rollback()
                return jsonify({"error": "an account with that email already exists"}), 409
    finally:
        conn.close()

    token = create_token(user["id"])
    return jsonify({"token": token, "user": user}), 201


@app.post("/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, email, name, password_hash FROM users WHERE email = %s",
                (email,),
            )
            user = cur.fetchone()
    finally:
        conn.close()

    if not user or not user["password_hash"] or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "invalid email or password"}), 401

    token = create_token(user["id"])
    return jsonify({"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"]}})


@app.get("/auth/google/callback")
def google_callback():
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    code = request.args.get("code")

    if not code:
        return redirect(f"{frontend_url}/login?{urlencode({'error': 'google_auth_failed'})}")

    token_response = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": os.environ["GOOGLE_CLIENT_ID"],
            "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
            "redirect_uri": os.environ["GOOGLE_REDIRECT_URI"],
            "grant_type": "authorization_code",
        },
        timeout=10,
    )

    if not token_response.ok:
        return redirect(f"{frontend_url}/login?{urlencode({'error': 'google_auth_failed'})}")

    # Scaffold only: the id_token's signature isn't verified against Google's
    # public keys here. Before going live, verify it with google-auth's
    # id_token.verify_oauth2_token instead of decoding it unchecked.
    claims = jwt.decode(token_response.json().get("id_token", ""), options={"verify_signature": False})
    email = claims.get("email")
    name = claims.get("name", "")

    if not email:
        return redirect(f"{frontend_url}/login?{urlencode({'error': 'google_auth_failed'})}")

    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id FROM users WHERE email = %s", (email,))
            user = cur.fetchone()
            if user:
                user_id = user["id"]
            else:
                cur.execute(
                    """
                    INSERT INTO users (email, name, auth_provider)
                    VALUES (%s, %s, 'google')
                    RETURNING id
                    """,
                    (email, name),
                )
                user_id = cur.fetchone()["id"]
            conn.commit()
    finally:
        conn.close()

    token = create_token(user_id)
    query = urlencode({"token": token, "email": email, "name": name})
    return redirect(f"{frontend_url}/auth/google/callback?{query}")


@app.post("/orders")
@require_auth
def create_order():
    data = request.get_json(silent=True) or {}
    items = data.get("items") or []
    address = (data.get("address") or "").strip()
    lat = data.get("lat")
    lng = data.get("lng")

    try:
        normalized_items = [
            {
                "item_name": item["item_name"],
                "price": float(item["price"]),
                "quantity": int(item.get("quantity", 1)),
            }
            for item in items
        ]
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "each item requires an item_name and price"}), 400

    if not normalized_items:
        return jsonify({"error": "items are required"}), 400

    if lat is not None and lng is not None:
        try:
            delivery_location = {"lat": float(lat), "lng": float(lng)}
        except (TypeError, ValueError):
            return jsonify({"error": "lat/lng must be numbers"}), 400
        delivery_address = address or None
    elif address:
        try:
            delivery_location = geocode_address(address)
        except requests.RequestException:
            return jsonify({"error": "could not verify that address right now"}), 502
        if not delivery_location:
            return jsonify({"error": "could not find that address"}), 400
        delivery_address = address
    else:
        return jsonify({"error": "a delivery address or lat/lng is required"}), 400

    total = sum(item["price"] * item["quantity"] for item in normalized_items)

    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO orders (user_id, status, total, delivery_address, delivery_lat, delivery_lng)
                VALUES (%s, 'placed', %s, %s, %s, %s)
                RETURNING id, status, total::float AS total, delivery_address, created_at
                """,
                (g.user_id, total, delivery_address, delivery_location["lat"], delivery_location["lng"]),
            )
            order = cur.fetchone()

            for item in normalized_items:
                cur.execute(
                    """
                    INSERT INTO order_items (order_id, item_name, price, quantity)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (order["id"], item["item_name"], item["price"], item["quantity"]),
                )
            conn.commit()
    finally:
        conn.close()

    order["items"] = normalized_items
    return jsonify(order), 201


@app.get("/orders")
@require_auth
def list_orders():
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, status, total::float AS total, delivery_address, created_at
                FROM orders
                WHERE user_id = %s
                ORDER BY created_at DESC
                """,
                (g.user_id,),
            )
            orders = cur.fetchall()

            for order in orders:
                cur.execute(
                    """
                    SELECT item_name, price::float AS price, quantity
                    FROM order_items
                    WHERE order_id = %s
                    """,
                    (order["id"],),
                )
                order["items"] = cur.fetchall()
    finally:
        conn.close()

    return jsonify(orders)


@app.patch("/orders/<int:order_id>/status")
@require_auth
def update_order_status(order_id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")

    if not status:
        return jsonify({"error": "status is required"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE orders SET status = %s
                WHERE id = %s AND user_id = %s
                RETURNING id, status, total::float AS total, created_at
                """,
                (status, order_id, g.user_id),
            )
            order = cur.fetchone()
            conn.commit()
    finally:
        conn.close()

    if not order:
        return jsonify({"error": "order not found"}), 404

    return jsonify(order)


@app.get("/orders/<int:order_id>/eta")
@require_auth
def get_order_eta(order_id):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT delivery_lat, delivery_lng FROM orders WHERE id = %s AND user_id = %s",
                (order_id, g.user_id),
            )
            order = cur.fetchone()
    finally:
        conn.close()

    if not order:
        return jsonify({"error": "order not found"}), 404

    destination = {"lat": order["delivery_lat"], "lng": order["delivery_lng"]}

    try:
        route = get_driving_route(DEPOT_LOCATION, destination)
    except requests.RequestException:
        return jsonify({"error": "could not reach the directions service"}), 502

    if not route:
        return jsonify({"error": "no driving route found for this order"}), 502

    base_minutes = route["duration_minutes"]
    result = {
        "distance_km": round(route["distance_km"], 1),
        "base_eta_minutes": round(base_minutes),
        "weather_adjusted_eta_minutes": round(base_minutes),
        "delay_risk": False,
        "condition": None,
    }

    try:
        weather = check_weather(destination["lat"], destination["lng"])
    except requests.RequestException:
        weather = None

    if weather:
        result["delay_risk"] = weather["delay_risk"]
        result["condition"] = weather["condition"]
        if weather["delay_risk"]:
            result["weather_adjusted_eta_minutes"] = round(base_minutes * WEATHER_DELAY_BUFFER)

    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True)
