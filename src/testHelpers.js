import { floorShow } from './engine.js'

// What a lane displays: [Pending Review, Deployed], each through floorShow.
export const shownCounts = (lane) => [floorShow(lane.pendingPrs), floorShow(lane.deployedPrs)]
