/**
 * Healthcare Greeting Node
 *
 * Welcomes the patient, collects their name, and detects initial intent.
 */

import { AIMessage } from '@langchain/core/messages';
import type { IGenericGraphState } from '../../../core/types';
import type { HealthcareProfile } from '../types';
import { healthcarePrompts, healthcareDisclosure } from '../config';

// ── Simple name extraction ──

function extractName(text: string): string | null {
  // "meu nome e X", "me chamo X", "sou o/a X", "eu sou X"
  const patterns = [
    /(?:meu nome (?:e|é))\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/i,
    /(?:me chamo)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/i,
    /(?:sou (?:o |a )?)\s*([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/i,
    /(?:eu sou)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return null;
}

// ── Intent Detection ──

type InitialIntent = 'appointment' | 'question' | 'emergency' | 'unknown';

function detectIntent(text: string): InitialIntent {
  const lower = text.toLowerCase();
  if (/emerg[eê]ncia|urgente|socorro|samu|192/.test(lower)) return 'emergency';
  if (/agendar|consulta|marcar|hor[aá]rio|atendimento/.test(lower)) return 'appointment';
  if (/d[uú]vida|pergunta|informa[cç][aã]o|como funciona/.test(lower)) return 'question';
  return 'unknown';
}

// ── Node Handler ──

export async function healthcareGreetingNode(
  state: IGenericGraphState
): Promise<Partial<IGenericGraphState>> {
  const lastMessage = state.messages[state.messages.length - 1];
  if (!lastMessage || typeof lastMessage.content !== 'string') {
    return {};
  }

  const userText = lastMessage.content;
  const profile = state.profile as HealthcareProfile;

  // Extract name if not yet known
  const name = profile.name || extractName(userText);
  const intent = detectIntent(userText);

  // Emergency: direct handoff
  if (intent === 'emergency') {
    return {
      messages: [
        new AIMessage(
          'Em caso de emergencia, ligue imediatamente para o *SAMU (192)* ou dirija-se ao pronto-socorro mais proximo. ' +
            healthcareDisclosure.handoff
        ),
      ],
      next: '__END__',
      profile: { ...profile, name: name || profile.name },
    };
  }

  // Build response
  let response: string;

  if (name) {
    response = `Ola, ${name}! Bem-vindo(a) ao nosso servico de agendamento. ${healthcareDisclosure.greeting}\n\nComo posso te ajudar hoje? Pode me contar seus sintomas ou a especialidade que procura.`;
  } else {
    response = `Ola! Bem-vindo(a) ao nosso servico de agendamento. ${healthcareDisclosure.greeting}\n\nPara comecar, qual e o seu nome?`;
  }

  // If we have the name, move to triage
  const next = name ? 'triage' : 'greeting';

  return {
    messages: [new AIMessage(response)],
    next,
    profile: { ...profile, name: name || profile.name },
    metadata: {
      ...state.metadata,
      lastMessageAt: Date.now(),
    },
    domainData: {
      ...state.domainData,
      _systemPrompt: healthcarePrompts.greeting,
    },
  };
}
