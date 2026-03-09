import { IntentHandler } from './base-handler';
import { scheduleHandler } from './schedule-handler';
import { handoffHandler } from './handoff-handler';
import { cashHandler } from './cash-handler';
import { financingHandler } from './financing-handler';
import { tradeInHandler } from './trade-in-handler';
import { rejectionHandler } from './rejection-handler';
import { interestHandler } from './interest-handler';
import { selectionHandler } from './selection-handler';
import { criteriaHandler } from './criteria-handler';

/**
 * All handlers sorted by priority (highest first).
 * Order: schedule > handoff > financing > cash > trade-in > rejection > interest > selection > criteria
 */
export const handlers: IntentHandler[] = [
  scheduleHandler,
  handoffHandler,
  cashHandler,
  financingHandler,
  tradeInHandler,
  rejectionHandler,
  interestHandler,
  selectionHandler,
  criteriaHandler,
].sort((a, b) => b.priority - a.priority);

export type { IntentHandler, HandlerContext, HandlerResult } from './base-handler';
