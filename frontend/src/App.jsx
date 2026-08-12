import { Navigate, Route, Routes } from "react-router-dom";
import NavBar from "./components/NavBar.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import SignupPage from "./pages/SignupPage.jsx";
import MenuPage from "./pages/MenuPage.jsx";
import OrdersPage from "./pages/OrdersPage.jsx";
import GoogleCallbackPage from "./pages/GoogleCallbackPage.jsx";

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="app-shell">
      {isAuthenticated && <NavBar />}
      <main className="app-main">
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/signup" element={isAuthenticated ? <Navigate to="/" replace /> : <SignupPage />} />
          <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MenuPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <OrdersPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
