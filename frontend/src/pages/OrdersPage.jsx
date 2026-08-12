import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import OrderCard from "../components/OrderCard.jsx";

export default function OrdersPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getOrders(token).then(setOrders).catch((err) => setError(err.message));
  }, [token]);

  const handleStatusChange = (orderId, status) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
  };

  return (
    <div className="screen">
      <h1>Your orders</h1>
      {error && <div className="form-error">{error}</div>}
      {orders.length === 0 && !error && <p className="empty-state">No orders yet — go grab a bite!</p>}
      <div className="orders-list">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
        ))}
      </div>
    </div>
  );
}
