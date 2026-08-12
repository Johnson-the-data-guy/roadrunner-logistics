import OrderTracker from "./OrderTracker.jsx";

const ACTIVE_STATUSES = new Set(["placed", "picked_up", "waypoint_1", "waypoint_2", "waypoint_3", "nearby"]);

function formatStatus(status) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function OrderCard({ order, onStatusChange }) {
  const isActive = ACTIVE_STATUSES.has(order.status);

  return (
    <div className="order-card">
      <div className="order-card-header">
        <div>
          <h3>Order #{order.id}</h3>
          <span className={`status-pill status-${order.status}`}>{formatStatus(order.status)}</span>
        </div>
        <span className="order-total">${Number(order.total).toFixed(2)}</span>
      </div>
      {order.delivery_address && <p className="order-address">📍 {order.delivery_address}</p>}
      <ul className="order-items">
        {order.items.map((item, idx) => (
          <li key={idx}>
            {item.quantity}× {item.item_name}
          </li>
        ))}
      </ul>
      {isActive && <OrderTracker order={order} onStatusChange={onStatusChange} />}
    </div>
  );
}
