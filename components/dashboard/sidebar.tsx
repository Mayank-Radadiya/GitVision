"use client";
import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  BarChart2,
  HomeIcon,
  LogOut,
  MessageSquare,
  PlusCircle,
  Settings,
  UserCircle,
  Code2Icon,
} from "lucide-react";
import { SignOutButton, useUser } from "@clerk/nextjs";
import ModeToggle from "../custom/mode-toggle";

const Sidebar = () => {
  const pathname = usePathname();
  const { user } = useUser();

  const navigation = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: HomeIcon,
    },
    {
      name: "Add Repository",
      href: "/dashboard/create-project",
      icon: PlusCircle,
    },
    {
      name: "Analytics",
      href: "/analytics",
      icon: BarChart2,
    },
    {
      name: "Chat",
      href: "/chat",
      icon: MessageSquare,
    },
    {
      name: "Github Code",
      href: "/code-viewer",
      icon: Code2Icon,
    },
  ];

  const secondaryNavigation = [
    {
      name: "Account",
      href: "/account",
      icon: UserCircle,
    },
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
    },
  ];

  return (
    <div className="flex h-full flex-col border-r border-gray-200 dark:border-[#1F1F23] bg-white/95 dark:bg-sidebar/80 backdrop-blur-sm w-64 shadow-sm transition-all">
      <div className="flex shrink-0 items-center gap-2 p-4">
        <Link
          href="/"
          className="group flex items-center gap-3 transition-all duration-300 px-5"
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-background via-background to-background ring-1 ring-primary/20 backdrop-blur-sm overflow-hidden shadow-lg transition-all duration-300 group-hover:shadow-primary/10">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-80"></div>
            <Image
              src={"/Github.svg"}
              alt="Logo"
              width={35}
              height={35}
              className="relative z-10 transition-transform duration-300 group-hover:scale-110"
            />
          </div>
          <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-xl font-bold tracking-tight text-transparent">
            Git<span className="text-primary">Vision</span>
          </span>
        </Link>
      </div>

      <div className="flex flex-col justify-between flex-1 overflow-y-auto pt-2">
        <div className="px-2 py-4 space-y-1">
          <p className="px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Application
          </p>
          {navigation.map((item) => (
            <Link key={item.name} href={item.href}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-x-3 my-1 rounded-md px-3 py-5 text-sm font-medium",
                  pathname === item.href
                    ? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1F1F23]"
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 flex-shrink-0",
                    pathname === item.href
                      ? "text-primary"
                      : "text-gray-500 dark:text-gray-400"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Button>
            </Link>
          ))}
        </div>

        <div className=" ">
          <div className="px-2 pb-4 space-y-1 ">
            <p className="px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Personal
            </p>
            {secondaryNavigation.map((item) => (
              <Link key={item.name} href={item.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-x-3 rounded-md px-3 py-5 text-sm font-medium",
                    pathname === item.href
                      ? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1F1F23]"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 flex-shrink-0",
                      pathname === item.href
                        ? "text-primary"
                        : "text-gray-500 dark:text-gray-400"
                    )}
                    aria-hidden="true"
                  />
                  {item.name}
                </Button>
              </Link>
            ))}

            <div className="pt-1 border-gray-200 dark:border-gray-800">
              <SignOutButton>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-x-3 rounded-md px-3 py-5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <LogOut
                    className="h-5 w-5 flex-shrink-0 text-gray-500 dark:text-gray-400"
                    aria-hidden="true"
                  />
                  Sign out
                </Button>
              </SignOutButton>
            </div>
          </div>

          <div className="flex flex-col  pt-4 pb-4 border-t border-gray-100 dark:border-gray-800">
            {user && (
              <div className="flex items-center gap-3 px-6 ">
                <div className="rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                  <Image
                    src={user.imageUrl}
                    alt={user.fullName || "User"}
                    className="h-9 w-9 object-cover"
                    width={30}
                    height={30}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {user.fullName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {user.primaryEmailAddress?.emailAddress}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between px-6 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                v1.0.0
              </span>
              <ModeToggle />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
