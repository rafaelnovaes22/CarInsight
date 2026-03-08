import { IGraphState } from '../../../../types/graph.types';

export interface HandlerContext {
  state: IGraphState;
  message: string;
  lowerMessage: string;
}

export interface HandlerResult {
  handled: boolean;
  result?: Partial<IGraphState>;
}

export interface IntentHandler {
  name: string;
  priority: number;
  canHandle(context: HandlerContext): boolean;
  handle(context: HandlerContext): Promise<HandlerResult> | HandlerResult;
}
