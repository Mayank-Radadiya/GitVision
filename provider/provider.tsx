import { ThemeProvider } from "next-themes";

interface providerProps {
  children: React.ReactNode;
}

const provider = ({ children }: providerProps) => {
  return (
    <>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        enableColorScheme
      >
        {children}
      </ThemeProvider>
    </>
  );
};

export default provider;
