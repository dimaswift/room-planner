export interface Vec2 {
  x: number;
  y: number;
}

/** Room outline. All plan coordinates are millimetres, x to the right, y down (screen convention). */
export interface Room {
  points: Vec2[];
  wallHeight: number;
  wallThickness: number;
  floorColor: string;
  wallColor: string;
  floorType?: 'planks' | 'parquet' | 'tiles' | 'concrete' | 'carpet';
  /** Skirting board height in mm (0 = none). */
  skirting?: number;
}

export interface Item {
  id: string;
  type: string;
  name: string;
  /** Plan centre (mm). Derived from wall + offset for openings. */
  x: number;
  y: number;
  /** Plan rotation in degrees, clockwise on screen. Front of an item faces +y at 0°. */
  rot: number;
  /** Height of the item's base above the floor (mm). Sill height for windows. */
  elev: number;
  params: Record<string, any>;
  /** Openings only: index of the wall the item sits in. */
  wall?: number;
  /** Openings only: distance from wall start to opening centre (mm). */
  offset?: number;
}

export interface Doc {
  version: 1;
  name: string;
  room: Room;
  items: Item[];
}

export interface Underlay {
  src: string;
  /** Top-left corner in plan mm. */
  x: number;
  y: number;
  mmPerPx: number;
  pxW: number;
  pxH: number;
  opacity: number;
}
