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

export type GeocodeResult = {
  coordinates: Coordinates;
  displayName?: string;
};

export type ServiceAreaEffect = 'include' | 'exclude';

export type ServiceAreaOrigin = {
  id: string;
  name?: string;
  coordinates: Coordinates;
};

export type RadiusServiceArea = {
  id: string;
  name?: string;
  type: 'radius';
  effect?: ServiceAreaEffect;
  originId: string;
  radius: number;
  unit: DistanceUnit;
};

export type PolygonServiceArea = {
  id: string;
  name?: string;
  type: 'polygon';
  effect?: ServiceAreaEffect;
  vertices: Coordinates[];
};

export type ServiceArea = RadiusServiceArea | PolygonServiceArea;

export type ServiceAreaConfiguration = {
  origins: ServiceAreaOrigin[];
  areas: ServiceArea[];
};

export type ServiceAreaCheck = {
  areaId: string;
  areaName?: string;
  type: ServiceArea['type'];
  effect: ServiceAreaEffect;
  method: string;
  originId?: string;
  originName?: string;
  providerId?: string;
  distance?: number;
  radius?: number;
  unit?: DistanceUnit;
  remainingDistance?: number;
  durationSeconds?: number;
  isMatch: boolean;
};

export type ServiceAreaMatch = Omit<ServiceAreaCheck, 'isMatch'>;

export type ServiceAreaStatus = 'inside' | 'outside' | 'excluded';

export type ServiceAreaEvaluation = {
  destination: Coordinates;
  isInside: boolean;
  status: ServiceAreaStatus;
  checks: ServiceAreaCheck[];
  matches: ServiceAreaMatch[];
  decidingMatch?: ServiceAreaMatch;
};
