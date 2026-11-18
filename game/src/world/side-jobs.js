// Two ways to make a living between story jobs: run the meter in a taxi, or carry parcels for the
// depot on foot. Both are repeatable, both put a marker on the map, both pay on arrival and pay
// nothing if the clock beats you there.

import { currentMarker } from './missions.js';

export const JOB_PAY = {
  taxiBase: 130,
  taxiPerPixel: 0.55,
  courierBase: 210,
  courierPerPixel: 0.3,
};

export function createJobState() {
  return {
    kind: null,
    active: false,
    timer: 0,
    duration: 0,
    marker: null,
    pay: 0,
    title: '',
  };
}

const DESTINATIONS = ['marina', 'hospital', 'precinct', 'club', 'depot', 'pawnshop', 'park', 'beach'];

function pickDestination(game, fromX, fromY) {
  let best = null;
  let bestGap = 0;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const id = game.random.pick(DESTINATIONS);
    const point = game.city.landmark(id);
    if (!point) continue;
    const gap = Math.hypot(point.x - fromX, point.y - fromY);
    if (gap > bestGap) {
      bestGap = gap;
      best = { ...point, id };
    }
  }
  return best && bestGap > 260 ? best : null;
}

export function startTaxiFare(game) {
  const job = game.job;
  if (job.active) return false;
  const px = game.player.inVehicle ? game.player.inVehicle.x : game.player.x;
  const py = game.player.inVehicle ? game.player.inVehicle.y : game.player.y;
  const destination = pickDestination(game, px, py);
  if (!destination) return false;
  const distance = Math.hypot(destination.x - px, destination.y - py);
  job.kind = 'taxi';
  job.active = true;
  job.title = 'Taxi fare';
  job.duration = 95;
  job.timer = 95;
  job.marker = { x: destination.x, y: destination.y, radius: 46, label: 'Fare' };
  job.pay = Math.round(JOB_PAY.taxiBase + distance * JOB_PAY.taxiPerPixel);
  game.addToast(`Fare to ${destination.id}  $${job.pay}`, 'mission');
  return true;
}

export function startCourierRun(game) {
  const job = game.job;
  if (job.active) return false;
  const depot = game.city.landmark('depot');
  const px = game.player.x;
  const py = game.player.y;
  if (!depot || Math.hypot(depot.x - px, depot.y - py) > 190) {
    game.addToast('Get to the depot to collect parcels', 'bad');
    return false;
  }
  const destination = pickDestination(game, px, py);
  if (!destination) return false;
  const distance = Math.hypot(destination.x - px, destination.y - py);
  job.kind = 'courier';
  job.active = true;
  job.title = 'Courier run';
  job.duration = 85;
  job.timer = 85;
  job.marker = { x: destination.x, y: destination.y, radius: 42, label: 'Drop' };
  job.pay = Math.round(JOB_PAY.courierBase + distance * JOB_PAY.courierPerPixel);
  game.addToast(`Parcel for ${destination.id}  $${job.pay}`, 'mission');
  return true;
}

export function endJob(game, success) {
  const job = game.job;
  if (!job.active) return;
  if (success) {
    game.money += job.pay;
    if (job.kind === 'taxi') game.stats.fares += 1;
    else game.stats.couriers += 1;
    game.addToast(`Job paid  +$${job.pay}`, 'money');
    game.audio?.cash();
    game.saveProgress?.();
  } else {
    game.addToast('Job failed', 'bad');
  }
  job.active = false;
  job.kind = null;
  job.marker = null;
}

export function stepJob(game, dt) {
  const job = game.job;
  if (!job.active) return;
  job.timer -= dt;
  if (job.timer <= 0) {
    endJob(game, false);
    return;
  }
  const player = game.player;
  const px = player.inVehicle ? player.inVehicle.x : player.x;
  const py = player.inVehicle ? player.inVehicle.y : player.y;
  if (job.kind === 'taxi' && !player.inVehicle) {
    endJob(game, false);
    return;
  }
  if (job.marker && Math.hypot(px - job.marker.x, py - job.marker.y) < (job.marker.radius ?? 40)) {
    endJob(game, true);
  }
}

/** The marker the HUD and the world should draw: story first, then the current job. */
export function activeObjectiveMarker(game) {
  if (game.mission.active && game.mission.marker) return game.mission.marker;
  if (game.job.active && game.job.marker) return game.job.marker;
  return currentMarker(game);
}
