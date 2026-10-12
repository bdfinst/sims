import { displayedDeployed, displayedPending } from './engine.js'

// What a lane displays: [Pending Review, Deployed].
export const shownCounts = (lane) => [displayedPending(lane), displayedDeployed(lane)]
