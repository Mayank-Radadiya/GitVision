import { memo } from "react";
import { Button } from "../ui/button";

const FailedToLoad = () => {
  return (
    <>
      <div className="p-6 max-w-md mx-auto   text-red-500/60 backdrop-blur-md">
        <p className="text-sm font-medium">⚠️ Failed to load repositories.</p>
        <Button
          onClick={() => window.location.reload()}
          className="mt-4 w-full bg-red-500/40 hover:bg-red-500/70 text-white"
        >
          Retry
        </Button>
      </div>
    </>
  );
};

export default memo(FailedToLoad);
