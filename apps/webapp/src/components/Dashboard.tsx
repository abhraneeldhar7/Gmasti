import { useEffect, useState } from "react";
import { fetchCurrentUser, getAuthRecord, logout, authenticatedFetch } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UsageChart } from "@/components/usageChart";

export default function Dashboard() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("free");
  const [usage, setUsage] = useState({ used_today: 0, remaining_today: 0, limit: 100 });

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
        setPlan(user.plan);
      })
      .catch(() => {
        window.location.replace("/?error=Session%20expired.%20Sign%20in%20again.");
      });

    authenticatedFetch("/usage/today")
      .then((res) => res.json())
      .then((data) => setUsage(data))
      .catch(() => { });
  }, []);

  const usagePercent = Math.min((usage.used_today / (usage.limit || 1)) * 100, 100);

  return (
    <div className="max-w-[600px] min-h-screen mx-auto w-full space-y-10 pt-20 px-5">
      <a
        href="/"
        className="text-sm w-fit text-muted-foreground hover:text-foreground flex items-center gap-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6"></path>
        </svg>
        Home
      </a>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{name || "User"}</h1>
          <p className="text-sm text-muted-foreground">{email}</p>
          <p className="text-xs mt-1">
            Plan: <span className={`font-semibold ${plan === "pro" ? "text-green-600" : ""}`}>{plan}</span>
            {plan !== "pro" && (
              <a href="/pro" className="ml-2 text-blue-500 hover:underline">Upgrade</a>
            )}
          </p>
        </div>
        <Button variant="outline" onClick={logout}>
          Logout
        </Button>
      </div>

      <div className="w-full space-y-2">
        <div className="flex justify-between">
          <p className="text-sm font-[450] text-muted-foreground">Today's Usage</p>
          <p className="text-sm font-[450]">
            {usage.used_today}/{usage.limit}
          </p>
        </div>
        <Progress value={usagePercent} />
        <p className="text-xs text-muted-foreground text-center">Resets every 24 hr</p>
      </div>

      <UsageChart />
    </div>
  );
}
