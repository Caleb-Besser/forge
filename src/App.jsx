import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import LoginScreen from "./components/LoginScreen";
import ToastNotification from "./components/ToastNotification";
import WorkoutLogPage from "./components/workout/WorkoutLogPage";
import { supabase } from "./supabaseClient";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const notificationTimer = useRef(null);

  const showToast = useCallback((message, type = "success", options = {}) => {
    window.clearTimeout(notificationTimer.current);
    setNotification({
      message,
      type,
      actionLabel: options.actionLabel,
      onAction: options.onAction,
    });
    notificationTimer.current = window.setTimeout(
      () => setNotification(null),
      options.duration ?? 5000,
    );
  }, []);

  useEffect(() => () => window.clearTimeout(notificationTimer.current), []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) showToast(error.message, "error");
      setSession(data?.session ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [showToast]);

  if (loading) {
    return <main className="loading-screen"><div className="loading-mark">F</div><p>Checking session...</p></main>;
  }

  return (
    <>
      <ToastNotification
        notification={notification}
        onDismiss={() => {
          window.clearTimeout(notificationTimer.current);
          setNotification(null);
        }}
      />
      {session ? (
        <WorkoutLogPage
          user={session.user}
          showToast={showToast}
          onSignOut={() => supabase.auth.signOut()}
        />
      ) : (
        <LoginScreen showToast={showToast} />
      )}
    </>
  );
}
