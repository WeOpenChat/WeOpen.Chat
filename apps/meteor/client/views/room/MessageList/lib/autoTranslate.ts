import { IMessage, isTranslatedMessageAttachment, isTranslatedMessage, MessageAttachment } from '@rocket.chat/core-typings';

export const hasTranslationLanguageInMessage = (message: IMessage, language: string): boolean =>
	isTranslatedMessage(message) && Boolean(message.translations?.[language]);

export const hasTranslationLanguageInAttachments = (attachments: MessageAttachment[] = [], language: string): boolean =>
	isTranslatedMessageAttachment(attachments) && attachments?.some((attachment) => attachment?.translations?.[language]);
