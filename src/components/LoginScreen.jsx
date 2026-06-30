import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function LoginScreen({ showToast }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleAuth(mode) {
    if (!email.trim() || !password) {
      setMessage("Enter both your email and password.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;

        if (data.session) {
          showToast("Account created. You are signed in.");
        } else {
          setMessage(
            "Account created. Check your email and confirm the account before logging in.",
          );
        }
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (!data.session) throw new Error("Supabase did not return a login session.");
      showToast("Logged in successfully.");
    } catch (error) {
      console.error(error);
      setMessage(error.message);
      showToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-main">
      <form
        id="input-section"
        onSubmit={(event) => {
          event.preventDefault();
          handleAuth("login");
        }}
      >
        <div className="header-kicker">Cloud Workout Log</div>
        <h1 className="login-title">Forge</h1>

        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            minLength="6"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {message && <p className="auth-message" role="status">{message}</p>}

        <div className="login-buttons">
          <button type="submit" disabled={busy}>
            {busy ? "Working..." : "Login"}
          </button>
          <button type="button" disabled={busy} onClick={() => handleAuth("signup")}>
            Signup
          </button>
        </div>
      </form>
    </main>
  );
}
