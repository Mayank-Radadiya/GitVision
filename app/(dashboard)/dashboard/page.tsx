import { SignOutButton } from "@clerk/nextjs";

export default function DashboardPage() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <SignOutButton></SignOutButton>
    </>
  );
}
