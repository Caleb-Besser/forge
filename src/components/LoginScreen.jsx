import { supabase } from "../supabaseClient";
import { useState } from "react";

async function signUp(email, password, showToast) {
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    console.error(error.message);
    showToast(error.message, "error");
    return;
  }

  console.log("Signed up:", data);
  showToast("Account created. You can log in now.");
}

async function signIn(email, password, showToast) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error(error.message);
    showToast(error.message, "error");
    return;
  }

  console.log("Signed In:", data);
  showToast("Logged in successfully.");
}

function LoginScreen({ showToast }) {
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  return (
    <main className="login-main">
      <section id="input-section">
        <h1 className="login-title">Workout Assistant</h1>

        <label>
          Email
          <input
            type="email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={userPassword}
            onChange={(e) => {
              setUserPassword(e.target.value);
            }}
          />
        </label>

        <div className="login-buttons">
          <button
            type="button"
            onClick={() => signIn(userEmail, userPassword, showToast)}
          >
            Login
          </button>

          <button
            type="button"
            onClick={() => signUp(userEmail, userPassword, showToast)}
          >
            Signup
          </button>
        </div>
      </section>
    </main>
  );
}

export default LoginScreen;
