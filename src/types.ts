export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type DistanceUnit = 'miles' | 'kilometers';

export type RadiusEvaluation = {
  distance: number;
  radius: number;
  unit: DistanceUnit;
  isInside: boolean;
};
