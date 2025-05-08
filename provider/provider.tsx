import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

interface providerProps {
  children: React.ReactNode;
}

const provider = ({ children }: providerProps) => {
  return (
    <>
      <ClerkProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          enableColorScheme
        >
          <Toaster />
          {children}
        </ThemeProvider>
      </ClerkProvider>
    </>
  );
};

export default provider;
