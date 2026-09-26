import type { APIRoute } from "astro";
import { bus } from "../../lib/events";
import { resetDemo } from "../../lib/store";

// There's no login, so every visitor shares the one demo student. This puts
// their records back to the seed state so a marker (or the next visitor)
// starts from a known place. The catalogue and degree rules aren't touched.
export const POST: APIRoute = ({ redirect }) => {
  try {
    resetDemo();
  } catch (error) {
    console.error("demo reset failed", error);
    return redirect("/?error=failed", 303);
  }
  bus.emit("change", { action: "reset" });
  return redirect("/?done=reset", 303);
};
