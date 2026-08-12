import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

export default function NavBar() {
  const { logout } = useAuth();

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <span className="navbar-logo">🐦</span>
        Roadrunner
      </div>
      <nav className="navbar-links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          Menu
        </NavLink>
        <NavLink to="/orders" className={({ isActive }) => (isActive ? "active" : "")}>
          Orders
        </NavLink>
      </nav>
      <div className="navbar-actions">
        <ThemeToggle />
        <button className="btn btn-ghost" onClick={logout}>
          Log out
        </button>
      </div>
    </header>
  );
}
