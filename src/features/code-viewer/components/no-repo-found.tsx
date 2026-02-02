import Link from "next/link";
import { Button } from "@/shared/components/ui/button";
import { memo } from "react";

const NoRepoFound = () => {
  return (
    <>
      <div className="text-center p-6  rounded-md max-w-2xl mx-auto">
        <p className="text-muted-foreground mb-4">No repositories found.</p>
        <Button asChild>
          <Link href="/dashboard/create-project">Create Repository</Link>
        </Button>
      </div>
    </>
  );
};

export default memo(NoRepoFound);
