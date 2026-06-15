export type Coordinates = {
  lat: number;
  lng: number;
};

export type RouteRequest = {
  pickup: Coordinates;
  drop: Coordinates;
};

export async function fetchRoute(_request: RouteRequest) {
  throw new Error("OpenRouteService route fetching will be implemented later.");
}

