import { useEffect, useState } from "react";
import { startGoogleLogin } from "../lib/auth";
import { Button } from "./ui/button";

export default function LoginButton() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      setMessage(error);
    }
  }, []);

  function handleLogin() {
    try {
      setBusy(true);
      startGoogleLogin();
    } catch (err) {
      setBusy(false);
      setMessage(
        err instanceof Error ? err.message : "Google sign-in is not configured.",
      );
    }
  }

  return (
    <>
      <Button type="button" disabled={busy} onClick={handleLogin}>
        Sign in with Google
      </Button>
      {message ? <p aria-live="polite">{message}</p> : null}
    </>
  );
}
