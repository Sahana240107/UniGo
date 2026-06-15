export type Coordinates = {
  lat: number;
  lng: number;
};

export type RideMatch = {
  id: string;
  pickup: Coordinates;
  drop: Coordinates;
  distanceMeters: number;
  womenOnly: boolean;
};

