import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function GoogleCallbackPage() {
  const [searchParams] = useSearchParams();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (token) {
      const email = searchParams.get("email") || "";
      const name = searchParams.get("name") || "";
      loginWithToken(token, { email, name });
      navigate("/", { replace: true });
    } else {
      navigate(`/login${error ? `?error=${error}` : ""}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="auth-screen">Signing you in…</div>;
}
