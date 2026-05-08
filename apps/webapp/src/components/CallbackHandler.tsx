import { useEffect, useState } from "react";
import { exchangeGoogleCode } from "../lib/auth";

export default function CallbackHandler() {
  const [status, setStatus] = useState("Signing you in…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (error) {
      window.location.replace(
        `/?error=${encodeURIComponent("Google sign-in was cancelled.")}`,
      );
      return;
    }

    if (!code) {
      window.location.replace(
        `/?error=${encodeURIComponent("Google sign-in did not return a code.")}`,
      );
      return;
    }

    exchangeGoogleCode(code)
      .then(() => {
        window.location.replace("/dashboard");
      })
      .catch((err) => {
        setStatus("Sign-in failed. Redirecting…");
        const message =
          err instanceof Error ? err.message : "Google sign-in failed.";
        window.location.replace(`/?error=${encodeURIComponent(message)}`);
      });
  }, []);

  return <p>{status}</p>;
}
