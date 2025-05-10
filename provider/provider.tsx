import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "react-hot-toast";

interface providerProps {
  children: React.ReactNode;
}

const Provider = ({ children }: providerProps) => {
  return (
    <ClerkProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        enableColorScheme
      >
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#333",
              color: "#fff",
            },
          }}
        />

        {children}
      </ThemeProvider>
    </ClerkProvider>
  );
};

export default Provider;
