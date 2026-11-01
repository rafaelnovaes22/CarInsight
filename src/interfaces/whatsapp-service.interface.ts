export interface SendMessageOptions {
  mediaId?: string; // Para áudio/imagem na Meta ou Evolution
  previewUrl?: boolean;
  quotedMessageId?: string;
}

export interface IWhatsAppService {
  /**
   * Envia uma mensagem de texto simples
   */
  sendMessage(to: string, content: string, options?: SendMessageOptions): Promise<void>;

  /**
   * Marca uma mensagem como lida
   */
  markMessageAsRead(messageId: string): Promise<void>;

  /**
   * Envia indicador de "digitando..."
   */
  sendTypingIndicator(to: string): Promise<void>;

  /**
   * Envia mensagem com botões (se suportado)
   */
  sendButtonMessage?(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>
  ): Promise<void>;

  /**
   * Obtém URL de mídia (para download de áudios/imagens)
   */
  getMediaUrl(mediaId: string): Promise<string>;
}
