import { useEffect, useState } from "react";
import appLogo from "./assets/appLogo.png";
import googleLogo from "./assets/googleLogo.png";
import { ModeSwitch } from "./components/modeSwitch";
import { Button } from "./components/ui/button";
import { ChevronDown, LogOutIcon, PencilIcon, SettingsIcon, UserRound } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "./components/ui/dialog";
import { Textarea } from "./components/ui/textarea";

import { Progress } from "./components/ui/progress";
import { ScrollArea } from "./components/ui/scroll-area";

const DEFAULT_SETTINGS = {
  enabled: true,
  theme: "random",
};

const MESSAGE_TYPES = {
  SAVE_SETTINGS: "SAVE_SETTINGS",
  GET_SESSION: "GET_SESSION",
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
};

const MAX_CUSTOM_PROMPT_LENGTH = 100;

const THEME_OPTIONS = [
  { value: "random", label: "Random" },
  { value: "caveman", label: "Caveman" },
  { value: "medieval_victorian_english", label: "Medieval" },
  { value: "genz_slop", label: "Gen Z Slop" },
  { value: "anime_kitten_uwu", label: "Anime Kitten UwU" },
  { value: "hood_lingo", label: "Hood Lingo" },
];

const WEBAPP_BASE_URL = import.meta.env.VITE_WEBAPP_BASE_URL;
if (!WEBAPP_BASE_URL) {
  throw new Error("VITE_WEBAPP_BASE_URL is required but not set in apps/extension/.env");
}

export default function App() {
  const [session, setSession] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [status, setStatus] = useState({ loading: true, message: "" });
  const [customPrompt, setCustomPrompt] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);

  useEffect(() => {
    refresh().catch((error) => {
      setStatus({ loading: false, message: error.message });
    });
  }, []);

  async function refresh() {
    setStatus({ loading: true, message: "" });
    const sessionState = await sendMessage(MESSAGE_TYPES.GET_SESSION);
    setSession(sessionState);
    setSettings(sessionState.settings || DEFAULT_SETTINGS);
    if (sessionState.settings?.custom_prompt) {
      setCustomPrompt(sessionState.settings.custom_prompt);
    }
    setStatus({ loading: false, message: "" });
  }

  async function handleLogin() {
    setStatus({ loading: true, message: "" });
    try {
      await sendMessage(MESSAGE_TYPES.LOGIN);
      await refresh();
    } catch (error) {
      setStatus({ loading: false, message: error.message });
    }
  }

  async function handleLogout() {
    await sendMessage(MESSAGE_TYPES.LOGOUT);
    await refresh();
  }

  async function updateSettings(nextPartial) {
    const nextSettings = await sendMessage(MESSAGE_TYPES.SAVE_SETTINGS, nextPartial);
    setSettings(nextSettings);
    setSession((current) =>
      current ? { ...current, settings: nextSettings } : current,
    );
  }

  function handleSaveCustom() {
    if (!customPrompt.trim()) return;
    updateSettings({ theme: "custom", custom_prompt: customPrompt.trim() });
    setCustomDialogOpen(false);
    setPopoverOpen(false);
  }

  function handleCustomClick() {
    if (customPrompt.trim()) {
      updateSettings({ theme: "custom" });
      setPopoverOpen(false);
    } else {
      setCustomDialogOpen(true);
    }
  }

  const themeLabel =
    settings.theme === "custom"
      ? "Custom"
      : (THEME_OPTIONS.find((t) => t.value === settings.theme)?.label || settings.theme);

  const isAuthenticated = session?.isAuthenticated;
  const usage = session?.usage || { usedToday: 0, limit: 100 };
  const usagePercent = Math.min((usage.usedToday / (usage.limit || 1)) * 100, 100);

  return (
    <div
      className="w-[320px] bg-[white] flex flex-col items-center p-5 pt-7"
      style={{
        background:
          "linear-gradient(0deg,rgba(255, 255, 255, 1) 50%, rgb(184, 225, 254) 100%)",
      }}
    >
      <img src={appLogo} className="h-[90px] w-[90px]" alt="Gmasti" />

      <div className="mt-6">
        <ModeSwitch
          checked={isAuthenticated ? settings.enabled : false}
          disabled={!isAuthenticated || status.loading}
          onCheckedChange={(checked) => updateSettings({ enabled: checked })}
        />
      </div>

      {isAuthenticated ? (
        <>
          <div className="mt-6 w-full">
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="secondary" size="lg" className="w-full justify-between border">
                  <ChevronDown className="opacity-0" />
                  {themeLabel}
                  <ChevronDown />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-[3px]">
                <ScrollArea className="h-[180px]">
                  <div className="flex flex-col gap-[3px]">
                    {THEME_OPTIONS.map((theme) => (
                      <Button
                        key={theme.value}
                        variant={settings.theme === theme.value ? "outline" : "ghost"}
                        className="w-full"
                        onClick={() => {
                          updateSettings({ theme: theme.value });
                          setPopoverOpen(false);
                        }}
                      >
                        {theme.label}
                      </Button>
                    ))}

                    <div className="flex gap-[3px]">
                      <Button
                        variant={settings.theme === "custom" ? "outline" : "secondary"}
                        className="flex-1"
                        onClick={handleCustomClick}
                      >
                        Custom
                      </Button>
                      <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="secondary" size="icon">
                            <PencilIcon />
                          </Button>
                        </DialogTrigger>
                        <DialogContent showCloseButton={false}>
                          <Textarea
                            className="h-[150px]"
                            placeholder="Describe how you want posts to be rewritten... (max 100 characters)"
                            value={customPrompt}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val.length <= MAX_CUSTOM_PROMPT_LENGTH) {
                                setCustomPrompt(val);
                              }
                            }}
                          />
                          <DialogFooter>
                            <DialogClose asChild className="md:flex-1">
                              <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button className="md:flex-1" onClick={handleSaveCustom}>
                              Save
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>

          <div className="mt-6 w-full space-y-2">
            <div className="flex justify-between">
              <p className="text-xs font-[450] text-muted-foreground">Usage</p>
              <p className="text-xs font-[450]">
                {usage.usedToday}/{usage.limit}
              </p>
            </div>
            <Progress value={usagePercent} />
            <p className="text-xs text-muted-foreground text-center">Resets every 24 hr</p>
          </div>

          <div className="flex mt-10 justify-between items-center w-full">
            <Button>Upgrade</Button>
            <Popover>
              <PopoverTrigger asChild>
                <SettingsIcon
                  size={24}
                  fill="white"
                  className="hover:rotate-[90deg] transition-all duration-300"
                />
              </PopoverTrigger>
              <PopoverContent className="p-[3px] w-[200px]">
                <div className="flex flex-col gap-[3px]">
                  <div className="p-3 flex gap-4">
                    <div className="shrink-0 p-1 h-full my-auto items-center flex justify-center">
                      <UserRound size={20} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="relative w-full h-[1.5em]">
                        <p className="absolute left-0 right-0 text-[16px] truncate">
                          {session?.user?.name || "User"}
                        </p>
                      </div>
                      <div className="relative w-full h-[1.5em]">
                        <p className="absolute left-0 right-0 text-[14px] truncate text-muted-foreground">
                          {maskEmail(session?.user?.email) || ""}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    className="justify-start gap-2 text-[16px]"
                    asChild
                  >
                    <a
                      href={`${WEBAPP_BASE_URL}/dashboard`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <UserRound className="size-4" /> Profile
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    className="justify-start text-[red] gap-2 text-[16px]"
                    onClick={handleLogout}
                  >
                    <LogOutIcon className="size-4" /> Logout
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </>
      ) : (
        <Button
          variant="ghost"
          size="lg"
          className="bg-background mt-7 gap-2 shadow-xs w-full"
          disabled={status.loading}
          onClick={handleLogin}
        >
          <img src={googleLogo} className="w-[24px] h-[24px]" alt="Google" />
          Continue with Google
        </Button>
      )}

      {status.message && (
        <p className="text-xs text-[red] mt-2 text-center w-full">{status.message}</p>
      )}

      {status.loading && <p className="text-xs text-muted-foreground mt-2">Syncing...</p>}
    </div>
  );
}

function maskEmail(email) {
  if (!email) return "";
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const maskedName =
    name.length > 3 ? name.slice(0, 3) + "******" : name.slice(0, 1) + "******";
  return `${maskedName}@${domain}`;
}

async function sendMessage(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, payload });
  if (!response?.ok) {
    throw new Error(response?.error || "Unknown extension error");
  }
  return response.data;
}
