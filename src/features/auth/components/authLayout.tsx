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
      <div className="bg-background relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
        <div className="bg-grid-small-black/10 dark:bg-grid-small-white/5 absolute inset-0"></div>
        <div className="bg-background absolute inset-0 mask-[radial-gradient(ellipse_at_center,transparent_0%,black_80%)]"></div>
        <div className="bg-grid-small-black/20 dark:bg-grid-small-white/5 absolute inset-0"></div>
        <div className="bg-background absolute inset-0 mask-[radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
        <div className="bg-primary/5 dark:bg-primary/10 absolute top-0 -left-1/4 h-125 w-125 rounded-full blur-[120px]"></div>
        <div className="absolute -right-1/4 bottom-0 h-125 w-125 rounded-full bg-emerald-500/5 blur-[120px] dark:bg-emerald-500/10"></div>
        <div className="absolute bottom-0 left-1/3 h-75 w-75 rounded-full bg-blue-500/5 blur-[80px] dark:bg-blue-500/10"></div>

        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <CustomToggleButton />
        </div>

        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground absolute top-4 left-4 z-10 flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm font-medium">Back</span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="z-10 mb-8"
        >
          <Link
            href="/"
            className="group flex items-center gap-4 transition-all duration-300"
          >
            <div className="from-background via-background to-muted ring-border group-hover:ring-primary/20 relative flex h-14 w-14 items-center justify-center rounded-xl bg-linear-to-br shadow-sm ring-1 transition-all duration-300 group-hover:shadow-md">
              <div className="from-primary/5 absolute inset-0 rounded-xl bg-linear-to-br to-transparent opacity-50"></div>
              <Image
                src={"/Github.svg"}
                alt="GitVision Logo"
                width={36}
                height={36}
                className="relative z-10 drop-shadow-sm transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <span className="from-foreground to-foreground/70 bg-linear-to-b bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
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
        <div className="text-muted-foreground/50 z-20 mt-12 text-center text-[10px] font-medium tracking-widest uppercase">
          <p className="flex flex-col items-center justify-center gap-1 sm:flex-row sm:gap-2">
            <span>By signing up, you agree to our</span>
            <span className="flex items-center gap-2">
              <Link
                href="/legal/terms-of-service"
                className="text-muted-foreground/80 hover:text-primary cursor-pointer transition-colors"
              >
                Terms of Service
              </Link>
              <span>&times;</span>
              <Link
                href="/legal/privacy-policy"
                className="text-muted-foreground/80 hover:text-primary cursor-pointer transition-colors"
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
