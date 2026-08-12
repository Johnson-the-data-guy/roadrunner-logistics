import { useTheme } from "../context/ThemeContext.jsx";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle color theme">
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
