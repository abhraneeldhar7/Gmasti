import { useEffect, useState } from "react";
import { fetchCurrentUser, getAuthRecord, logout } from "../lib/auth";

export default function Dashboard() {
  const [name, setName] = useState("Loading…");
  const [email, setEmail] = useState("Loading…");

  useEffect(() => {
    const auth = getAuthRecord();
    if (!auth?.accessToken) {
      window.location.replace("/");
      return;
    }

    if (auth.user) {
      setName(auth.user.name);
      setEmail(auth.user.email);
    }

    fetchCurrentUser()
      .then((user) => {
        setName(user.name);
        setEmail(user.email);
      })
      .catch(() => {
        window.location.replace("/?error=Session%20expired.%20Sign%20in%20again.");
      });
  }, []);

  return (
    <div className="card">
      <p className="label">Name</p>
      <p className="value">{name}</p>
      <p className="label">Email</p>
      <p className="value">{email}</p>
      <button type="button" onClick={logout}>
        Logout
      </button>
    </div>
  );
}
