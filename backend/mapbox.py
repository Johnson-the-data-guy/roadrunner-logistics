import os
from urllib.parse import quote

import requests

GEOCODE_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places/{}.json"
DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/driving/{}"


def _api_key():
    return os.environ["MAPBOX_API_KEY"]


def geocode_address(address):
    url = GEOCODE_URL.format(quote(address))
    resp = requests.get(url, params={"access_token": _api_key(), "limit": 1}, timeout=10)
    resp.raise_for_status()

    features = resp.json().get("features") or []
    if not features:
        return None

    lng, lat = features[0]["center"]
    return {"lat": lat, "lng": lng}


def get_driving_route(origin, destination):
    coords = f"{origin['lng']},{origin['lat']};{destination['lng']},{destination['lat']}"
    url = DIRECTIONS_URL.format(coords)
    resp = requests.get(url, params={"access_token": _api_key(), "overview": "false"}, timeout=10)
    resp.raise_for_status()

    routes = resp.json().get("routes") or []
    if not routes:
        return None

    route = routes[0]
    return {"distance_km": route["distance"] / 1000, "duration_minutes": route["duration"] / 60}
