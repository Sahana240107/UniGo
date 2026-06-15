import type { Coordinates } from "@/lib/maps/openroute";

export type CommuteIntent = "coming_today" | "not_today";

export type RideVisibility = "all" | "women_only";

export type RideSearchInput = {
  pickup: Coordinates;
  drop: Coordinates;
  visibility: RideVisibility;
};

