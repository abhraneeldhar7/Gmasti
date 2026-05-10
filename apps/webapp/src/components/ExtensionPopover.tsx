import appLogo from "@/assets/appLogo.png";
import { ModeSwitch } from "./extensionTest/modeSwitch";
import { Button } from "./ui/button";
import { ChevronDown, LogOutIcon, PencilIcon, SettingsIcon, UserIcon, UserRound } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "./ui/dialog";
import { Textarea } from "./ui/textarea";
import { Progress } from "./ui/progress";
import googleLogo from "@/assets/googleLogo.png";


export default function ExtensionPopover() {

    const themes = ["Random", "Caveman", "Mideaval"]

    return (<div className="w-[320px] bg-[white] border flex flex-col items-center rounded-[15px] p-5 pt-7" style={{
        background: "linear-gradient(0deg,rgba(255, 255, 255, 1) 50%, rgb(151, 209, 250) 100%)"
    }}>
        <img src={appLogo.src} className="h-[90px] w-[90px]" />

        <div className="mt-6">
            <ModeSwitch />
        </div>

        <div className="mt-6 w-full">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="secondary" size="lg" className="w-full justify-between border">
                        <ChevronDown className="opacity-0" />
                        {themes[0]}
                        <ChevronDown />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="p-[3px]">
                    <div className="flex flex-col gap-[3px]">
                        {themes.map((theme, index) => (
                            <Button key={index} variant={index == 0 ? "outline" : "ghost"} className="w-full">
                                {theme}
                            </Button>
                        ))}

                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="secondary">
                                    <PencilIcon /> Custom
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="" showCloseButton={false}>
                                <Textarea className="h-[240px]" />
                                <DialogFooter>
                                    <DialogClose asChild className="md:flex-1">
                                        <Button variant="outline">
                                            Cancel
                                        </Button>
                                    </DialogClose>
                                    <Button className="md:flex-1">Save</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                    </div>
                </PopoverContent>
            </Popover>
        </div>

        <div className="mt-6 w-full space-y-2">
            <div className="flex justify-between">
                <p className="text-xs font-[450] text-muted-foreground">Usage</p>
                <p className="text-xs font-[450]">10/100</p>
            </div>
            <Progress value={20} />
            <p className="text-xs text-muted-foreground text-center">Resets every 24 hr</p>
        </div>

        <div className="flex mt-10 justify-between items-center w-full">
            <a href="/pro" target="_blank" rel="noopener noreferrer">
              <Button>Upgrade</Button>
            </a>
            <Popover>
                <PopoverTrigger asChild>
                    <SettingsIcon size={24} fill="white" className="hover:rotate-[90deg] transition-all duraiton-300" />
                </PopoverTrigger>
                <PopoverContent className="p-[3px] w-[200px]">
                    <div className="flex flex-col gap-[3px]">
                        <div className="p-3 flex gap-4">
                            <div className="shrink-0 p-1 h-full my-auto items-center flex justify-center">
                                <UserRound size={20} />
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="relative w-full h-[1.5em]">
                                    <p className="absolute left-0 right-0 text-[16px] truncate">Abhraneel Dhar</p>
                                </div>
                                <div className="relative w-full h-[1.5em]">
                                    <p className="absolute left-0 right-0 text-[14px] truncate text-muted-foreground">abh******@gmail.com</p>
                                </div>
                            </div>
                        </div>
                        <Button variant="ghost" className="justify-start gap-2 text-[16px]" ><UserRound className="size-4" /> Profile</Button>
                        <Button variant="ghost" className="justify-start text-[red] gap-2 text-[16px]" ><LogOutIcon className="size-4" /> Logout</Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>

        {/* <Button variant="ghost" size="lg" className="bg-background mt-7 gap-2 shadow-xs w-full">
            <img src={googleLogo.src} className="w-[24px] h-[24px]" />
            Continue with Google
        </Button> */}

    </div>)
}