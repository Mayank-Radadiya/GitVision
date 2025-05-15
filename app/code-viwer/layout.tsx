import { Metadata } from "next";

export const metadata: Metadata = {
  title: "GitVision - Code Viewer",
  description: "View and analyze your repository code with syntax highlighting",
};

export default function CodeViewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <section className="min-h-screen">{children}</section>;
}
