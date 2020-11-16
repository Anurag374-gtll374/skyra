import { AdderKey, GuildEntity, GuildSettings } from '@lib/database';
import { CustomFunctionGet, CustomGet, GuildMessage, KeyOfType } from '@lib/types';
import { Events, PermissionLevels } from '@lib/types/Enums';
import { CLIENT_ID } from '@root/config';
import { Awaited } from '@sapphire/utilities';
import { AdderError } from '@utils/Adder';
import { MessageLogsEnum } from '@utils/constants';
import { floatPromise } from '@utils/util';
import { GuildMember, MessageEmbed, TextChannel } from 'discord.js';
import { KlasaMessage, Language, Monitor } from 'klasa';
import { SelfModeratorBitField, SelfModeratorHardActionFlags } from './SelfModeratorBitField';

export abstract class ModerationMonitor<T = unknown> extends Monitor {
	public async run(message: GuildMessage) {
		const shouldRun = await this.checkPreRun(message);
		if (!shouldRun) return;

		if (await message.hasAtLeastPermissionLevel(PermissionLevels.Moderator)) return;

		const preProcessed = await this.preProcess(message);
		if (preProcessed === null) return;

		const [filter, adder, language] = await message.guild.readSettings((settings) => [
			settings[this.softPunishmentPath],
			settings.adders[this.hardPunishmentPath.adder],
			settings.getLanguage()
		]);
		const bitField = new SelfModeratorBitField(filter);
		this.processSoftPunishment(message, language, bitField, preProcessed);

		if (this.hardPunishmentPath === null) return;

		if (!adder) return this.processHardPunishment(message, language, 0, 0);

		const points = typeof preProcessed === 'number' ? preProcessed : 1;
		try {
			adder.add(message.author.id, points);
		} catch (error) {
			await this.processHardPunishment(message, language, (error as AdderError).amount, adder.maximum);
		}
	}

	public shouldRun(message: KlasaMessage) {
		return (
			this.enabled &&
			message.guild !== null &&
			message.author !== null &&
			message.webhookID === null &&
			message.type === 'DEFAULT' &&
			!message.system &&
			!message.author.bot
		);
	}

	protected processSoftPunishment(message: GuildMessage, language: Language, bitField: SelfModeratorBitField, preProcessed: T) {
		if (bitField.has(SelfModeratorBitField.FLAGS.DELETE) && message.deletable) {
			floatPromise(this, this.onDelete(message, language, preProcessed) as any);
		}

		if (bitField.has(SelfModeratorBitField.FLAGS.ALERT) && message.channel.postable) {
			floatPromise(this, this.onAlert(message, language, preProcessed) as any);
		}

		if (bitField.has(SelfModeratorBitField.FLAGS.LOG)) {
			floatPromise(this, this.onLog(message, language, preProcessed) as any);
		}
	}

	protected async processHardPunishment(message: GuildMessage, language: Language, points: number, maximum: number) {
		const [action, duration] = await message.guild.readSettings([this.hardPunishmentPath.action, this.hardPunishmentPath.actionDuration]);
		switch (action) {
			case SelfModeratorHardActionFlags.Warning:
				await this.onWarning(message, language, points, maximum, duration);
				break;
			case SelfModeratorHardActionFlags.Kick:
				await this.onKick(message, language, points, maximum);
				break;
			case SelfModeratorHardActionFlags.Mute:
				await this.onMute(message, language, points, maximum, duration);
				break;
			case SelfModeratorHardActionFlags.SoftBan:
				await this.onSoftBan(message, language, points, maximum);
				break;
			case SelfModeratorHardActionFlags.Ban:
				await this.onBan(message, language, points, maximum, duration);
				break;
		}
	}

	protected async onWarning(message: GuildMessage, language: Language, points: number, maximum: number, duration: number | null) {
		await this.createActionAndSend(message, () =>
			message.guild.security.actions.warning({
				userID: message.author.id,
				moderatorID: CLIENT_ID,
				reason:
					maximum === 0
						? language.get(this.reasonLanguageKey)
						: language.get(this.reasonLanguageKeyWithMaximum, { amount: points, maximum }),
				duration
			})
		);
	}

	protected async onKick(message: GuildMessage, language: Language, points: number, maximum: number) {
		await this.createActionAndSend(message, () =>
			message.guild.security.actions.kick({
				userID: message.author.id,
				moderatorID: CLIENT_ID,
				reason:
					maximum === 0
						? language.get(this.reasonLanguageKey)
						: language.get(this.reasonLanguageKeyWithMaximum, { amount: points, maximum })
			})
		);
	}

	protected async onMute(message: GuildMessage, language: Language, points: number, maximum: number, duration: number | null) {
		await this.createActionAndSend(message, () =>
			message.guild.security.actions.mute({
				userID: message.author.id,
				moderatorID: CLIENT_ID,
				reason:
					maximum === 0
						? language.get(this.reasonLanguageKey)
						: language.get(this.reasonLanguageKeyWithMaximum, { amount: points, maximum }),
				duration
			})
		);
	}

	protected async onSoftBan(message: GuildMessage, language: Language, points: number, maximum: number) {
		await this.createActionAndSend(message, () =>
			message.guild.security.actions.softBan(
				{
					userID: message.author.id,
					moderatorID: CLIENT_ID,
					reason:
						maximum === 0
							? language.get(this.reasonLanguageKey)
							: language.get(this.reasonLanguageKeyWithMaximum, { amount: points, maximum })
				},
				1
			)
		);
	}

	protected async onBan(message: GuildMessage, language: Language, points: number, maximum: number, duration: number | null) {
		await this.createActionAndSend(message, () =>
			message.guild.security.actions.ban(
				{
					userID: message.author.id,
					moderatorID: CLIENT_ID,
					reason:
						maximum === 0
							? language.get(this.reasonLanguageKey)
							: language.get(this.reasonLanguageKeyWithMaximum, { amount: points, maximum }),
					duration
				},
				0
			)
		);
	}

	protected async createActionAndSend(message: GuildMessage, performAction: () => unknown): Promise<void> {
		const unlock = message.guild.moderation.createLock();
		await performAction();
		unlock();
	}

	protected onLog(message: GuildMessage, language: Language, value: T): Awaited<void> {
		this.client.emit(Events.GuildMessageLog, MessageLogsEnum.Moderation, message.guild, this.onLogMessage.bind(this, message, language, value));
	}

	protected abstract keyEnabled: KeyOfType<GuildEntity, boolean>;
	protected abstract ignoredRolesPath: KeyOfType<GuildEntity, readonly string[]>;
	protected abstract ignoredChannelsPath: KeyOfType<GuildEntity, readonly string[]>;
	protected abstract softPunishmentPath: KeyOfType<GuildEntity, number>;
	protected abstract hardPunishmentPath: HardPunishment;
	protected abstract reasonLanguageKey: CustomGet<string, string>;

	protected abstract reasonLanguageKeyWithMaximum: CustomFunctionGet<string, { amount: number; maximum: number }, string>;

	protected abstract preProcess(message: GuildMessage): Promise<T | null> | T | null;
	protected abstract onDelete(message: GuildMessage, language: Language, value: T): Awaited<unknown>;
	protected abstract onAlert(message: GuildMessage, language: Language, value: T): Awaited<unknown>;
	protected abstract onLogMessage(message: GuildMessage, language: Language, value: T): Awaited<MessageEmbed>;

	private checkPreRun(message: GuildMessage) {
		return message.guild.readSettings(
			(settings) =>
				settings[this.keyEnabled] &&
				this.checkMessageChannel(settings, message.channel as TextChannel) &&
				this.checkMemberRoles(settings, message.member)
		);
	}

	private checkMessageChannel(settings: GuildEntity, channel: TextChannel) {
		const globalIgnore = settings[GuildSettings.Selfmod.IgnoreChannels];
		if (globalIgnore.includes(channel.id)) return false;

		const localIgnore = settings[this.ignoredChannelsPath];
		if (localIgnore.includes(channel.id)) return false;

		return true;
	}

	private checkMemberRoles(settings: GuildEntity, member: GuildMember | null) {
		if (member === null) return false;

		const ignoredRoles = settings[this.ignoredRolesPath];
		if (ignoredRoles.length === 0) return true;

		const { roles } = member;
		return !ignoredRoles.some((id) => roles.cache.has(id));
	}
}

export interface HardPunishment {
	action: KeyOfType<GuildEntity, number>;
	actionDuration: KeyOfType<GuildEntity, number | null>;
	adder: AdderKey;
}
