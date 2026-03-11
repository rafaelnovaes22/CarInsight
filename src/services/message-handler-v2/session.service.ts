import { cache } from '../../lib/redis';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { maskPhoneNumber } from '../../lib/privacy';

export class MessageHandlerSessionService {
  async resetConversation(phoneNumber: string): Promise<void> {
    try {
      const conversations = await prisma.conversation.findMany({
        where: { phoneNumber },
      });

      for (const conversation of conversations) {
        const stateKey = `conversation:${conversation.id}:state`;
        await cache.del(stateKey);
      }

      await prisma.conversation.updateMany({
        where: {
          phoneNumber,
          status: 'active',
        },
        data: {
          status: 'closed',
          resolutionStatus: 'USER_RESET',
          closedAt: new Date(),
        },
      });

      logger.info(
        { phoneNumber: maskPhoneNumber(phoneNumber), count: conversations.length },
        'Conversation reset'
      );
    } catch (error) {
      logger.error(
        { error, phoneNumber: maskPhoneNumber(phoneNumber) },
        'Error resetting conversation'
      );
    }
  }
}
