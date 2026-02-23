import CustomToggleButton from "@/src/shared/components/theme/mode-toggle";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";

interface AuthLayoutProps {
  children: React.ReactNode;
}

function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <>
      <div className="flex min-h-screen flex-col items-center justify-center bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-small-black/[0.1] dark:bg-grid-small-white/[0.05]"></div>
        <div className="absolute inset-0 bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_0%,black_80%)]"></div>
        <div className="absolute inset-0 bg-grid-small-black/[0.2] dark:bg-grid-small-white/[0.05]"></div>
        <div className="absolute inset-0 bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
        <div className="absolute -left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px] dark:bg-primary/10"></div>
        <div className="absolute -right-1/4 bottom-0 h-[500px] w-[500px] rounded-full bg-emerald-500/5 blur-[120px] dark:bg-emerald-500/10"></div>
        <div className="absolute left-1/3 bottom-0 h-[300px] w-[300px] rounded-full bg-blue-500/5 blur-[80px] dark:bg-blue-500/10"></div>

        <div className="absolute right-4 top-4 flex items-center gap-2 z-10">
          <CustomToggleButton />
        </div>

        <Link
          href="/"
          className="absolute left-4 top-4 flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground z-10"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm font-medium">Back</span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 z-10"
        >
          <Link
            href="/"
            className="group flex items-center gap-4 transition-all duration-300"
          >
            <div className="relative flex  h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-background via-background to-muted ring-1 ring-border shadow-sm transition-all duration-300 group-hover:shadow-md group-hover:ring-primary/20">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50 rounded-xl"></div>
              <Image
                src={"/Github.svg"}
                alt="GitVision Logo"
                width={36}
                height={36}
                className="relative z-10 drop-shadow-sm transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <span className="bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
              Git<span className="text-primary tracking-normal">Vision</span>
            </span>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="z-10 w-full max-w-md px-4 sm:px-0"
        >
          {children}
        </motion.div>
        <div className="mt-12 z-20 text-center text-[10px] uppercase tracking-widest text-muted-foreground/50 font-medium">
          <p className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2">
            <span>By signing up, you agree to our</span>
            <span className="flex items-center gap-2">
              <Link
                href="/legal/terms-of-service"
                className="text-muted-foreground/80 hover:text-primary transition-colors cursor-pointer"
              >
                Terms of Service
              </Link>
              <span>&times;</span>
              <Link
                href="/legal/privacy-policy"
                className="text-muted-foreground/80 hover:text-primary transition-colors cursor-pointer"
              >
                Privacy Policy
              </Link>
            </span>
          </p>
        </div>
      </div>
    </>
  );
}

export default AuthLayout;
