// The city's six districts: where each sits, how tall its buildings grow, and the colours its
// streets, sidewalks and walls are painted. Art and simulation both read from here, so a
// district looks and feels like itself wherever it appears on the map.

export const DISTRICTS = {
  downtown: {
    id: 'downtown',
    name: 'Calder Heights',
    ground: '#4a4740',
    sidewalk: '#a9a49a',
    sidewalkEdge: '#bdb7aa',
    road: '#3b3a38',
    lane: '#e8dcbc',
    building: ['#d9cfbb', '#c9c1b4', '#efe3c8', '#b7b2ae', '#e0cdb0', '#cfd6d2'],
    wall: ['#9c9488', '#8c857b', '#a8a093', '#7f7a71'],
    glass: ['#5d8f96', '#46707f', '#79a3a5', '#3f5f6d'],
    accent: '#e8743b',
    roof: '#8f877a',
    height: [78, 190],
    density: 0.94,
    awning: 0.12,
  },
  docks: {
    id: 'docks',
    name: 'Pier Nine',
    ground: '#4c4a42',
    sidewalk: '#98938a',
    sidewalkEdge: '#a8a298',
    road: '#3a3a39',
    lane: '#d8cfae',
    building: ['#8d7a63', '#7d6b58', '#9b8a6d', '#6f6a5e', '#a3906f'],
    wall: ['#5f574b', '#6b6153', '#544e45', '#71675a'],
    glass: ['#4f6a6a', '#3f5656', '#5d7772'],
    accent: '#c75b39',
    roof: '#6b6458',
    height: [44, 96],
    density: 0.78,
    awning: 0.05,
  },
  beach: {
    id: 'beach',
    name: 'Marisol Strip',
    ground: '#e6cfa3',
    sidewalk: '#e8dcc0',
    sidewalkEdge: '#f2e8d2',
    road: '#4a4640',
    lane: '#f3e7c6',
    building: ['#f2c9b4', '#f6dcc4', '#bfe0d6', '#f7e9c9', '#e8b9a4', '#cfe4e8'],
    wall: ['#c79d8b', '#cbb191', '#94b3ad', '#d3c0a1'],
    glass: ['#6fb3b8', '#8ac7c5', '#4f8e9a'],
    accent: '#f07a6a',
    roof: '#cfa98c',
    height: [30, 62],
    density: 0.6,
    awning: 0.5,
  },
  park: {
    id: 'park',
    name: 'Verdano Park',
    ground: '#6f8a4e',
    sidewalk: '#d7cdb4',
    sidewalkEdge: '#e2d8bf',
    road: '#43423d',
    lane: '#e9ddba',
    building: ['#d5c8a8'],
    wall: ['#9c9179'],
    glass: ['#5b7f78'],
    accent: '#7fa653',
    roof: '#8a7f68',
    height: [24, 40],
    density: 0.12,
    awning: 0,
  },
  residential: {
    id: 'residential',
    name: 'Larkspur Row',
    ground: '#7d8a5c',
    sidewalk: '#cfc7ae',
    sidewalkEdge: '#dbd3ba',
    road: '#414140',
    lane: '#e6d9b6',
    building: ['#f0d8b2', '#e8c8a6', '#d9d2b4', '#f2e1c4', '#dcc3ad', '#cbd9c2'],
    wall: ['#b39a7d', '#a88f79', '#9f9d80', '#b8a88b'],
    glass: ['#6c8f92', '#7fa2a0'],
    accent: '#c96e4d',
    roof: '#b26b4f',
    height: [26, 50],
    density: 0.58,
    awning: 0.3,
  },
  market: {
    id: 'market',
    name: 'Union Market',
    ground: '#585247',
    sidewalk: '#b3ab9c',
    sidewalkEdge: '#c2b9a8',
    road: '#3d3c39',
    lane: '#e5d8b6',
    building: ['#e3cbaa', '#d3b795', '#efe0c0', '#c9b9a4', '#dcc9a0'],
    wall: ['#a08b73', '#95816b', '#ab9780'],
    glass: ['#5f8f8c', '#467372'],
    accent: '#d4673c',
    roof: '#96826c',
    height: [38, 82],
    density: 0.86,
    awning: 0.42,
  },
};

/** The district a point inside the grid belongs to, by where it sits in the city. */
export function districtAt(x, y, city) {
  const u = x / city.width;
  const v = y / city.height;
  if (v > 0.86) return DISTRICTS.beach;
  if (u < 0.27 && v > 0.18) return DISTRICTS.docks;
  if (u > 0.66 && v < 0.32) return DISTRICTS.park;
  if (u > 0.64 && v >= 0.32) return DISTRICTS.residential;
  if (u >= 0.27 && u <= 0.68 && v <= 0.58) return DISTRICTS.downtown;
  if (v > 0.75) return DISTRICTS.beach;
  return DISTRICTS.market;
}

/** The district label the minimap and the area toast show. */
export function districtLabel(district) {
  return district.name;
}
