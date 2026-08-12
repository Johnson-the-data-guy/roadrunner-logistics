import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

const STEPS = [
  { key: "picked_up", label: "Picked up" },
  { key: "waypoint_1", label: "In transit" },
  { key: "waypoint_2", label: "In transit" },
  { key: "waypoint_3", label: "In transit" },
  { key: "nearby", label: "Nearby" },
  { key: "delivered", label: "Delivered" },
];

function stepPositions() {
  const count = STEPS.length;
  return STEPS.map((_, i) => {
    const x = 20 + i * (260 / (count - 1));
    const isEndpoint = i === 0 || i === count - 1;
    const y = isEndpoint ? 60 : i % 2 === 0 ? 42 : 78;
    return { x, y };
  });
}

export default function OrderTracker({ order, onStatusChange }) {
  const { token } = useAuth();
  const [eta, setEta] = useState(null);
  const [etaError, setEtaError] = useState("");
  const [stepIndex, setStepIndex] = useState(() => {
    const idx = STEPS.findIndex((s) => s.key === order.status);
    return idx === -1 ? 0 : idx;
  });

  useEffect(() => {
    api
      .getOrderEta(order.id, token)
      .then(setEta)
      .catch((err) => setEtaError(err.message));
  }, [order.id, token]);

  // Paces the marker across the remaining steps using the real (weather
  // adjusted) ETA, instead of a fixed interval per step.
  useEffect(() => {
    if (!eta || stepIndex >= STEPS.length - 1) return undefined;

    const totalMs = Math.max(eta.weather_adjusted_eta_minutes, 1) * 60 * 1000;
    const stepMs = totalMs / (STEPS.length - 1);

    const timer = setTimeout(() => {
      setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
    }, stepMs);

    return () => clearTimeout(timer);
  }, [eta, stepIndex]);

  useEffect(() => {
    const nextStatus = STEPS[stepIndex].key;
    if (nextStatus === order.status) return;
    api
      .updateOrderStatus(order.id, nextStatus, token)
      .then((updated) => onStatusChange?.(order.id, updated.status))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  const positions = stepPositions();
  const current = positions[stepIndex];
  const isDelivered = stepIndex === STEPS.length - 1;

  return (
    <div className="tracker">
      <div className="tracker-header">
        <div className="tracker-label">{STEPS[stepIndex].label}</div>
        {eta && !isDelivered && (
          <div className="tracker-eta">
            {eta.weather_adjusted_eta_minutes} min · {eta.distance_km} km
          </div>
        )}
      </div>
      {eta?.delay_risk && !isDelivered && (
        <div className="tracker-weather">
          ⛈️ {eta.condition} — running ~{eta.weather_adjusted_eta_minutes - eta.base_eta_minutes} min slower
        </div>
      )}
      {etaError && <div className="tracker-weather">Couldn't load ETA: {etaError}</div>}
      <svg viewBox="0 0 300 120" className="tracker-svg" preserveAspectRatio="xMidYMid meet">
        <polyline
          points={positions.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="var(--tracker-line)"
          strokeWidth="3"
          strokeDasharray="2 8"
          strokeLinecap="round"
        />
        {positions.map((p, i) => (
          <circle
            key={STEPS[i].key}
            cx={p.x}
            cy={p.y}
            r={i === 0 || i === STEPS.length - 1 ? 7 : 5}
            className={`tracker-dot ${i <= stepIndex ? "tracker-dot-done" : ""}`}
          />
        ))}
        <circle cx={current.x} cy={current.y} r="9" className="tracker-marker" />
      </svg>
    </div>
  );
}
