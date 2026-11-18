// The story: six jobs that start with a package run and end with the harbour on fire. Each one is
// a list of steps — go somewhere, take something, put somebody down, shake the police — with its
// own marker, objective line, time limit and leash. Death, the clock running out or wandering too
// far from the job all fail it, and a failed job can be retried without losing progress.

import { clamp, TAU, wrapAngle } from '../core/math2d.js';
import { createPedestrian } from './pedestrians.js';
import { buildRoute, headingFor, makeWaypoints } from './traffic.js';
import { createVehicle, stepVehicle } from './vehicles.js';
import { addWanted, clearWanted } from './wanted.js';

export const MISSIONS = [
  {
    id: 'first-shift',
    title: 'First Shift',
    giver: 'Marisol',
    portrait: 'marisol',
    reward: 900,
    intro: [
      { speaker: 'Marisol', portrait: 'marisol', text: 'New face. Good. My driver called in sick and this crate will not walk itself to Pier Nine.' },
      { speaker: 'Marisol', portrait: 'marisol', text: 'Pick it up at the freight depot, run it down to the shed, and do not open it. Ninety seconds, sweetheart.' },
    ],
    steps: [
      { kind: 'goto', place: 'depot', radius: 78, text: 'Collect the crate at the Harbor Freight Depot', time: 150 },
      { kind: 'goto', place: 'dockshed', radius: 84, text: 'Deliver the crate to Pier Nine Shed', time: 120, leash: 900 },
    ],
  },
  {
    id: 'tail-job',
    title: 'Tail Job',
    giver: 'Calder',
    portrait: 'calder',
    reward: 1500,
    intro: [
      { speaker: 'Calder', portrait: 'calder', text: 'A courier has been carrying my ledgers to the wrong people. He is leaving the market now, in a grey sedan.' },
      { speaker: 'Calder', portrait: 'calder', text: 'Put him off the road. Gently is fine. Then deal with whoever comes to collect.' },
    ],
    steps: [
      { kind: 'ram', text: 'Force the courier off the road', time: 150, radius: 120 },
      { kind: 'kill', count: 2, place: 'market', text: 'Take out the courier\u2019s escort', time: 120 },
    ],
  },
  {
    id: 'blue-heron',
    title: 'The Blue Heron',
    giver: 'Vera',
    portrait: 'vera',
    reward: 2400,
    intro: [
      { speaker: 'Vera', portrait: 'vera', text: 'Five men came into my club tonight and put their feet on my tables. They are still there.' },
      { speaker: 'Vera', portrait: 'vera', text: 'I do not need them removed politely. I need them removed. The door is open.' },
    ],
    steps: [
      { kind: 'goto', place: 'club', radius: 90, text: 'Get to The Blue Heron', time: 120 },
      { kind: 'kill', count: 5, place: 'club', text: 'Clear the club', time: 180, radius: 460 },
    ],
  },
  {
    id: 'pier-nine',
    title: 'Pier Nine',
    giver: 'Salvador',
    portrait: 'salvador',
    reward: 3600,
    intro: [
      { speaker: 'Salvador', portrait: 'salvador', text: 'That crate you moved? It was a sample. Tonight the whole container comes off the dock, and it comes off without paperwork.' },
      { speaker: 'Salvador', portrait: 'salvador', text: 'Take it from the shed. The alarm is already singing, so plan on leaving quickly.' },
    ],
    steps: [
      { kind: 'goto', place: 'dockshed', radius: 86, text: 'Reach the shed on Pier Nine', time: 150 },
      { kind: 'collect', place: 'dockshed', text: 'Load the container onto your car', time: 60 },
      { kind: 'escape', text: 'Lose the police with the container', time: 200 },
    ],
  },
  {
    id: 'heat',
    title: 'Heat',
    giver: 'Vera',
    portrait: 'vera',
    reward: 4800,
    intro: [
      { speaker: 'Vera', portrait: 'vera', text: 'They know it was you at the pier. Every cruiser in the harbour is looking for a car with a dented door.' },
      { speaker: 'Vera', portrait: 'vera', text: 'Stay alive for a minute, then disappear. Do not lead them here.' },
    ],
    steps: [
      { kind: 'survive', seconds: 45, stars: 3, text: 'Survive the response', time: 60 },
      { kind: 'escape', text: 'Break line of sight and lose the heat', time: 220 },
    ],
  },
  {
    id: 'last-call',
    title: 'Last Call',
    giver: 'Marisol',
    portrait: 'marisol',
    reward: 7500,
    intro: [
      { speaker: 'Marisol', portrait: 'marisol', text: 'The man who owns the container owns half the docks, and tonight he is at the marina with four friends.' },
      { speaker: 'Marisol', portrait: 'marisol', text: 'After this there is no coming back to the cab stand. Make it count, then get out of the harbour.' },
    ],
    steps: [
      { kind: 'goto', place: 'marina', radius: 96, text: 'Drive out to Tidewater Marina', time: 150 },
      { kind: 'kill', count: 5, place: 'marina', text: 'End it at the marina', time: 200, radius: 520 },
      { kind: 'escape', text: 'Leave the harbour for good', time: 240 },
    ],
  },
];

export function createMissionState() {
  return {
    index: 0,
    step: 0,
    active: false,
    failed: null,
    complete: false,
    timer: 0,
    progress: 0,
    marker: null,
    target: null,
    hostiles: [],
    startedAt: 0,
    payout: 0,
    line: '',
  };
}

export function missionById(id) {
  return MISSIONS.find((mission) => mission.id === id) ?? null;
}

function placePoint(game, place) {
  const landmark = game.city.landmark(place);
  if (landmark) return { x: landmark.x, y: landmark.y };
  return { x: game.player.x, y: game.player.y };
}

/** A point on the nearest lane, for markers a car has to reach. */
export function laneSpot(game, x, y) {
  const lane = game.city.roads.nearestLanePoint(x, y);
  return { x: lane.x, y: lane.y };
}

function spawnHostiles(game, x, y, count, spread = 90) {
  const spawned = [];
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * TAU + game.random.range(-0.4, 0.4);
    const ped = createPedestrian(game, game.random.pick(game.city.roads.blocks), 0, 1);
    ped.x = x + Math.cos(angle) * spread + game.random.range(-30, 30);
    ped.y = y + Math.sin(angle) * spread + game.random.range(-30, 30);
    ped.hostile = true;
    ped.health = 55;
    ped.shirt = game.random.pick(['#2f3a44', '#4a2f3a', '#33302c']);
    ped.hat = game.random.chance(0.5);
    ped.state = 'walk';
    game.peds.push(ped);
    spawned.push(ped);
  }
  return spawned;
}

function beginStep(game) {
  const mission = MISSIONS[game.mission.index];
  const step = mission.steps[game.mission.step];
  const state = game.mission;
  state.timer = step.time ?? 999;
  state.progress = 0;
  state.target = null;
  state.hostiles = [];

  if (step.kind === 'kill') {
    const point = placePoint(game, step.place);
    state.hostiles = spawnHostiles(game, point.x, point.y, step.count, 110);
    state.marker = { x: point.x, y: point.y, radius: step.radius ?? 420, label: 'Targets' };
  } else if (step.kind === 'ram') {
    const point = placePoint(game, 'market');
    const node = game.city.roads.nearestNode(point.x, point.y).node;
    const car = createVehicle('sedan', node.x + 40, node.y + 22, 0, game.random, { color: '#7d858c' });
    car.ai = 'flee';
    car.routeTimer = 0;
    car.waypoints = [];
    car.waypointIndex = 0;
    game.vehicles.push(car);
    state.target = car;
    state.marker = { x: car.x, y: car.y, radius: 90, label: 'Courier' };
  } else if (step.kind === 'survive') {
    addWanted(game, step.stars ?? 3, 'story');
    state.marker = null;
  } else if (step.kind === 'escape') {
    state.marker = null;
    if (step.kind === 'escape' && game.wanted.level < 2) addWanted(game, 2, 'story');
  } else {
    const point = placePoint(game, step.place);
    state.marker = { x: point.x, y: point.y, radius: step.radius ?? 80, label: step.text };
  }
  state.line = step.text;
  game.objective = step.text;
}

export function startMission(game, index) {
  const mission = MISSIONS[index];
  if (!mission) return false;
  game.mission.index = index;
  game.mission.step = 0;
  game.mission.active = true;
  game.mission.failed = null;
  game.mission.complete = false;
  game.mission.startedAt = game.clock.time;
  game.mission.line = mission.title;
  game.mission.marker = null;
  for (const line of mission.intro) game.say(line);
  game.addToast(`Mission: ${mission.title}`, 'mission');
  beginStep(game);
  return true;
}

export function retryMission(game) {
  const state = game.mission;
  state.failed = null;
  state.active = true;
  state.step = 0;
  state.timer = 0;
  game.player.health = Math.max(60, game.player.health);
  game.player.dead = false;
  clearWanted(game);
  beginStep(game);
  game.addToast('Retrying the job', 'mission');
}

export function failMission(game, reason) {
  const state = game.mission;
  if (!state.active || state.failed) return;
  state.failed = reason;
  state.active = false;
  game.addToast(reason, 'bad');
  game.audio?.fail();
}

export function completeStep(game) {
  const state = game.mission;
  const mission = MISSIONS[state.index];
  state.step += 1;
  if (state.step >= mission.steps.length) {
    finishMission(game);
  } else {
    game.addToast('Objective complete', 'good');
    beginStep(game);
  }
}

function finishMission(game) {
  const state = game.mission;
  const mission = MISSIONS[state.index];
  state.active = false;
  state.complete = true;
  state.marker = null;
  state.index = Math.min(MISSIONS.length, state.index + 1);
  state.step = 0;
  game.money += mission.reward;
  state.payout = mission.reward;
  game.stats.missionsDone = Math.max(game.stats.missionsDone, state.index);
  game.addToast(`${mission.title} complete  +$${mission.reward}`, 'money');
  game.audio?.cash();
  game.say({ speaker: mission.giver, portrait: mission.portrait, text: 'That is the job done. There is more where that came from.' });
  if (state.index >= MISSIONS.length) {
    game.objective = 'The harbour is yours. Free roam.';
    game.addToast('Story complete', 'good');
  }
  game.saveProgress?.();
}

function fleeDriver(game, car, dt) {
  const roads = game.city.roads;
  const player = game.player;
  const px = player.inVehicle ? player.inVehicle.x : player.x;
  const py = player.inVehicle ? player.inVehicle.y : player.y;
  car.routeTimer = (car.routeTimer ?? 0) - dt;
  if (car.routeTimer <= 0 || !car.waypoints || car.waypointIndex >= car.waypoints.length) {
    car.routeTimer = 2.6;
    // Head for the node that is furthest from the player, so the chase keeps moving.
    let best = 0;
    let bestGap = -1;
    for (const node of roads.nodes) {
      const gap = Math.hypot(node.x - px, node.y - py);
      if (gap > bestGap) {
        bestGap = gap;
        best = node.index;
      }
    }
    const from = roads.nearestNode(car.x, car.y).node.index;
    const path = roads.route(from, best).slice(0, 7);
    const route = [];
    for (let index = 0; index < path.length - 1; index += 1) {
      const a = path[index];
      const b = path[index + 1];
      const direction = b === a + 1 ? 0 : b === a - 1 ? 2 : b === a + roads.cols ? 1 : 3;
      route.push({
        from: a,
        to: b,
        direction,
        axis: direction === 0 || direction === 2 ? 'ew' : 'ns',
        entry: { x: roads.nodes[a].x, y: roads.nodes[a].y },
        exit: { x: roads.nodes[b].x, y: roads.nodes[b].y },
      });
    }
    car.route = route;
    car.waypoints = makeWaypoints(route);
    car.waypointIndex = 0;
  }
  const waypoints = car.waypoints ?? [];
  let target = { x: px, y: py };
  if (waypoints.length && car.waypointIndex < waypoints.length) {
    target = waypoints[car.waypointIndex];
    while (Math.hypot(target.x - car.x, target.y - car.y) < 60 && car.waypointIndex < waypoints.length - 1) {
      car.waypointIndex += 1;
      target = waypoints[car.waypointIndex];
    }
  }
  const bearing = Math.atan2(target.y - car.y, target.x - car.x);
  const error = wrapAngle(bearing - car.angle);
  stepVehicle(car, { throttle: 1, steer: clamp(error * 2.4, -1, 1), brake: Math.abs(error) > 1 ? 0.4 : 0, handbrake: 0 }, dt, game.city, game.trails);
}

export function stepMission(game, dt) {
  const state = game.mission;

  // The courier of the tail job keeps driving whether or not the step is live.
  if (state.target && state.target.ai === 'flee') {
    fleeDriver(game, state.target, dt);
    if (state.marker) {
      state.marker.x = state.target.x;
      state.marker.y = state.target.y;
    }
  }

  if (!state.active || state.failed) return;
  const mission = MISSIONS[state.index];
  const step = mission.steps[state.step];
  if (!step) return;

  const player = game.player;
  const px = player.inVehicle ? player.inVehicle.x : player.x;
  const py = player.inVehicle ? player.inVehicle.y : player.y;

  state.timer -= dt;
  if (state.timer <= 0) {
    failMission(game, 'Out of time');
    return;
  }

  if (state.marker && step.leash) {
    const gap = Math.hypot(px - state.marker.x, py - state.marker.y);
    if (gap > step.leash) {
      failMission(game, 'You left the job');
      return;
    }
  }

  if (step.kind === 'goto' || step.kind === 'collect') {
    const point = placePoint(game, step.place);
    state.marker = { x: point.x, y: point.y, radius: step.radius ?? 80, label: step.text };
    if (Math.hypot(px - point.x, py - point.y) < (step.radius ?? 80)) {
      if (step.kind === 'collect') {
        addWanted(game, 2, 'heist');
        game.addToast('The container is yours', 'mission');
      }
      completeStep(game);
    }
  } else if (step.kind === 'kill') {
    const alive = state.hostiles.filter((ped) => ped.state !== 'gone' && ped.health > 0).length;
    state.progress = state.hostiles.length - alive;
    state.line = `${step.text}  (${state.progress}/${state.hostiles.length})`;
    game.objective = state.line;
    if (state.hostiles.length > 0 && alive === 0) completeStep(game);
  } else if (step.kind === 'ram') {
    const target = state.target;
    if (!target) {
      completeStep(game);
    } else if (target.health < 45 || target.wrecked) {
      addWanted(game, 1, 'story');
      state.target = null;
      completeStep(game);
    }
  } else if (step.kind === 'survive') {
    state.progress = Math.max(0, (step.seconds ?? 40) - state.timer);
    state.line = `Hold out  ${Math.ceil(Math.max(0, (step.seconds ?? 40) - state.progress))}s`;
    game.objective = state.line;
    if (state.progress >= (step.seconds ?? 40)) completeStep(game);
  } else if (step.kind === 'escape') {
    state.line = game.wanted.level > 0 ? `Lose the police  (${game.wanted.level} stars)` : step.text;
    game.objective = state.line;
    if (game.wanted.level === 0) completeStep(game);
  }
}

/** The marker the world and the minimap should draw for the next thing to do. */
export function currentMarker(game) {
  if (game.mission.active && game.mission.marker) return game.mission.marker;
  if (game.mission.index < MISSIONS.length) {
    const mission = MISSIONS[game.mission.index];
    const first = mission.steps[0];
    const point = placePoint(game, first.place ?? 'club');
    return { x: point.x, y: point.y, radius: 70, label: mission.title };
  }
  return null;
}

export { laneSpot as missionLaneSpot };
