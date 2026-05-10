import { useEffect, useState } from "react";
import { fetchCurrentUser, getAuthRecord, authenticatedFetch } from "@/lib/auth";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type UserInfo = {
  user_id: string;
  email: string;
  name: string;
  plan: string;
  razorpay_subscription_id: string | null;
  razorpay_current_period_end: string | null;
  razorpay_cancel_at_period_end: boolean;
};

export default function ProCheckout() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const auth = getAuthRecord();
    if (!auth?.accessToken) {
      window.location.replace("/");
      return;
    }
    fetchCurrentUser()
      .then((u) => setUser(u as unknown as UserInfo))
      .catch(() => window.location.replace("/"))
      .finally(() => setLoading(false));
  }, []);

  async function handleProceed() {
    setCreating(true);
    setError("");
    try {
      const res = await authenticatedFetch("/subscription/create", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to create subscription.");
      }

      const options = {
        key: data.razorpay_key_id,
        subscription_id: data.subscription_id,
        name: "Gmasti",
        description: "Pro Plan",
        prefill: { email: user?.email || "" },
        modal: {
          ondismiss: () => setCreating(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setCreating(false);
    }
  }

  async function handleCancel() {
    setError("");
    if (!confirm("Cancel your Pro subscription? You'll stay Pro until the end of the current billing period.")) return;
    try {
      const res = await authenticatedFetch("/subscription/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to cancel.");
      await fetchCurrentUser().then((u) => setUser(u as unknown as UserInfo));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (loading) {
    return <p className="text-center text-muted-foreground py-20">Loading...</p>;
  }

  const isPro = user?.plan === "pro";

  return (
    <div className="max-w-[500px] mx-auto py-20 px-5 space-y-8">
      <a href="/" className="text-sm text-muted-foreground hover:text-foreground">&larr; Home</a>

      <h1 className="text-3xl font-bold">Gmasti Pro</h1>

      <div className="border rounded-xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Current plan</span>
          <span className={`font-semibold uppercase text-sm ${isPro ? "text-green-600" : ""}`}>
            {user?.plan || "free"}
          </span>
        </div>

        {isPro && user?.razorpay_cancel_at_period_end && user?.razorpay_current_period_end && (
          <p className="text-sm text-amber-600">
            Your subscription will end on{" "}
            {new Date(user.razorpay_current_period_end).toLocaleDateString()}.
          </p>
        )}
      </div>

      <div className="border rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold">Pro features</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>&check; Up to 1,000 rewrites per day</li>
          <li>&check; Priority support</li>
        </ul>
      </div>

      {!isPro && (
        <Button
          className="w-full py-6 text-lg"
          disabled={creating}
          onClick={handleProceed}
        >
          {creating ? "Creating subscription..." : "Proceed"}
        </Button>
      )}

      {isPro && !user?.razorpay_cancel_at_period_end && (
        <Button
          variant="outline"
          className="w-full"
          onClick={handleCancel}
        >
          Cancel subscription
        </Button>
      )}

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
    </div>
  );
}
