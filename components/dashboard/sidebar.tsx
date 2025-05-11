"use client";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GitBranch,
  MessagesSquare,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ModeToggle from "@/components/custom/mode-toggle";
import { useUser, SignOutButton } from "@clerk/nextjs";

const routes = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    label: "Repository Analysis",
    icon: GitBranch,
    href: "/dashboard/repo-analysis",
  },
  {
    label: "AI Assistant",
    icon: MessagesSquare,
    href: "/dashboard/chat",
  },
];

const Sidebar = () => {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();

  return (
    <div className="flex h-full flex-col space-y-4 bg-background py-4 border-r border-border/50">
      {/* Logo at the top */}
      <div className="px-3 py-2 flex-1">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="group flex items-center gap-3 transition-all duration-300"
          >
            <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-background via-background to-background ring-1 ring-primary/20 backdrop-blur-sm overflow-hidden shadow-lg transition-all duration-300 group-hover:shadow-primary/10">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-80"></div>
              <Image
                src={"/Github.svg"}
                alt="Logo"
                width={30}
                height={30}
                className="relative z-10 transition-transform duration-300 group-hover:scale-110"
              />
            </div>
            <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-xl font-bold tracking-tight text-transparent">
              Git<span className="text-primary">Vision</span>
            </span>
          </Link>

          <ModeToggle />
        </div>

        {/* Navigation Routes */}
        <div className="space-y-1.5 mt-10">
          {routes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:bg-muted/50 rounded-lg transition",
                pathname === route.href
                  ? "bg-muted text-primary/80 font-semibold"
                  : "text-muted-foreground"
              )}
            >
              <div className="flex items-center">
                <route.icon className="h-5 w-5 mr-3" />
                {route.label}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* User information  at the bottom*/}
      <div className="px-3 py-2 mt-auto">
        <div className="flex items-center gap-2 bg-accent/5 p-1 rounded-lg">
          <div className="relative h-10 w-10">
            {isLoaded && user?.imageUrl ? (
              <Image
                src={user.imageUrl}
                alt="User avatar"
                width={45}
                height={45}
                className="rounded-full object-cover"
              />
            ) : (
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" />
              </Avatar>
            )}
          </div>
          <div className="flex items-center overflow-hidden">
            <span className="text-sm text-muted-foreground truncate">
              {isLoaded
                ? user?.emailAddresses?.[0]?.emailAddress || "Unknown"
                : "example.user@gmail.com"}
            </span>
            <SignOutButton>
              <button
                className="p-2 rounded-full hover:bg-muted/70 transition"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="size-5 text-muted-foreground" />
              </button>
            </SignOutButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
