import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import MenuItemCard from "../components/MenuItemCard.jsx";

export default function MenuPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    api.getMenu().then(setMenu).catch((err) => setError(err.message));
  }, []);

  const addItem = (item) => setCart((c) => ({ ...c, [item.id]: (c[item.id] || 0) + 1 }));

  const removeItem = (item) =>
    setCart((c) => {
      const next = { ...c };
      if (next[item.id] > 1) next[item.id] -= 1;
      else delete next[item.id];
      return next;
    });

  const handleAddressChange = (e) => {
    setAddress(e.target.value);
    if (coords) setCoords(null);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation isn't supported in this browser");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAddress("");
        setLocating(false);
      },
      (err) => {
        setLocationError(err.message || "Could not get your location");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const cartItems = menu
    .filter((item) => cart[item.id])
    .map((item) => ({ item_name: item.name, price: item.price, quantity: cart[item.id] }));
  const cartTotal = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  const placeOrder = async () => {
    if (!coords && !address.trim()) {
      setError("Add a delivery address or use your location");
      return;
    }
    setPlacing(true);
    setError("");
    try {
      const location = coords ? { lat: coords.lat, lng: coords.lng } : { address: address.trim() };
      await api.createOrder(cartItems, location, token);
      setCart({});
      setAddress("");
      setCoords(null);
      navigate("/orders");
    } catch (err) {
      setError(err.message);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="screen">
      <h1>What are you craving?</h1>
      {error && <div className="form-error">{error}</div>}
      <div className="menu-grid">
        {menu.map((item) => (
          <MenuItemCard
            key={item.id}
            item={item}
            quantity={cart[item.id] || 0}
            onAdd={() => addItem(item)}
            onRemove={() => removeItem(item)}
          />
        ))}
      </div>
      {cartCount > 0 && (
        <div className="delivery-card">
          <h3>Delivery location</h3>
          <div className="delivery-row">
            <input
              type="text"
              placeholder="Enter delivery address"
              value={address}
              onChange={handleAddressChange}
            />
            <button className="btn btn-ghost btn-sm" onClick={useMyLocation} disabled={locating}>
              {locating ? "Locating…" : "📍 Use my location"}
            </button>
          </div>
          {coords && (
            <p className="location-hint">
              Using your current location ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
            </p>
          )}
          {locationError && <div className="form-error">{locationError}</div>}
        </div>
      )}
      {cartCount > 0 && (
        <div className="cart-bar">
          <span>
            {cartCount} item{cartCount > 1 ? "s" : ""} · ${cartTotal.toFixed(2)}
          </span>
          <button className="btn" onClick={placeOrder} disabled={placing}>
            {placing ? "Placing order..." : "Place order"}
          </button>
        </div>
      )}
    </div>
  );
}
