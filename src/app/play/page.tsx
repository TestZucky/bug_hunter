import { Suspense } from "react";
import { PlayClient } from "./PlayClient";

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[100dvh] flex items-center justify-center text-muted-foreground">
          Loading run…
        </div>
      }
    >
      <PlayClient />
    </Suspense>
  );
}
