import { useEffect, useState } from "react";
import { getAuthRecord } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import LoginButton from "@/components/LoginButton";

export default function AuthState() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const auth = getAuthRecord();
    setAuthed(Boolean(auth?.accessToken));
  }, []);

  if (authed) {
    return (
      <a href="/dashboard" className="flex-1">
        <Button size="lg" className="w-full">
          Dashboard
        </Button>
      </a>
    );
  }

  return <LoginButton className="flex-1" />;
}
