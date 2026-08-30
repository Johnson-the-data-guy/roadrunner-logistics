import os

import requests

WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"


def _api_key():
    return os.environ["OPENWEATHER_API_KEY"]


def check_weather(lat, lng):
    resp = requests.get(
        WEATHER_URL,
        params={"lat": lat, "lon": lng, "appid": _api_key(), "units": "metric"},
        timeout=10,
    )
    resp.raise_for_status()

    conditions = resp.json().get("weather") or []
    if not conditions:
        return None

    condition = conditions[0]
    # OpenWeatherMap condition codes: 2xx thunderstorm, 3xx drizzle, 5xx rain,
    # 6xx snow, 7xx+ fog/mist/clear/clouds.
    delay_risk = condition["id"] < 700

    return {"delay_risk": delay_risk, "condition": condition["description"].capitalize()}
