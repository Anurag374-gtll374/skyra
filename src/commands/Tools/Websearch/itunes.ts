import { LanguageKeys } from '#lib/i18n/languageKeys';
import { PaginatedMessageCommand, SkyraPaginatedMessage } from '#lib/structures';
import { formatNumber } from '#utils/functions';
import { sendLoadingMessage } from '#utils/util';
import { time, TimestampStyles } from '@discordjs/builders';
import { ApplyOptions } from '@sapphire/decorators';
import { fetch, FetchResultTypes } from '@sapphire/fetch';
import { Message, MessageEmbed } from 'discord.js';
import type { TFunction } from 'i18next';
import { URL } from 'node:url';

@ApplyOptions<PaginatedMessageCommand.Options>({
	description: LanguageKeys.Commands.Tools.ITunesDescription,
	detailedDescription: LanguageKeys.Commands.Tools.ITunesExtended
})
export class UserPaginatedMessageCommand extends PaginatedMessageCommand {
	public async messageRun(message: Message, args: PaginatedMessageCommand.Args) {
		const song = await args.rest('string');

		const response = await sendLoadingMessage(message, args.t);
		const { results: entries } = await this.fetchAPI(args.t, song);
		if (!entries.length) this.error(LanguageKeys.System.NoResults);

		const display = await this.buildDisplay(message, args.t, entries);
		await display.run(response, message.author);
		return response;
	}

	private async fetchAPI(t: TFunction, song: string) {
		try {
			const url = new URL('https://itunes.apple.com/search');
			url.searchParams.append('country', 'US');
			url.searchParams.append('entity', 'song');
			url.searchParams.append('explicit', 'no');
			url.searchParams.append('lang', t.lng.toLowerCase());
			url.searchParams.append('limit', '10');
			url.searchParams.append('media', 'music');
			url.searchParams.append('term', song);

			return await fetch<AppleItunesResult>(url, FetchResultTypes.JSON);
		} catch {
			this.error(LanguageKeys.System.QueryFail);
		}
	}

	private async buildDisplay(message: Message, t: TFunction, entries: ItunesData[]) {
		const titles = t(LanguageKeys.Commands.Tools.ITunesTitles);
		const display = new SkyraPaginatedMessage({
			template: new MessageEmbed().setColor(await this.container.db.fetchColor(message))
		}).setSelectMenuOptions((pageIndex) => ({
			label: entries[pageIndex - 1].trackName
		}));

		for (const song of entries) {
			display.addPageEmbed((embed) =>
				embed
					.setThumbnail(song.artworkUrl100)
					.setTitle(song.trackName)
					.setURL(song.trackViewUrl)
					.addField(titles.artist, `[${song.artistName}](${song.artistViewUrl})`, true)
					.addField(titles.collection, `[${song.collectionName}](${song.collectionViewUrl})`, true)
					.addField(titles.collectionPrice, `$${song.collectionPrice}`, true)
					.addField(titles.trackPrice, `$${song.trackPrice}`, true)
					.addField(titles.trackReleaseDate, time(new Date(song.releaseDate), TimestampStyles.ShortDate), true)
					.addField(titles.numberOfTracksInCollection, formatNumber(t, song.trackCount), true)
					.addField(titles.primaryGenre, song.primaryGenreName, true)
					.addField(titles.preview, `[${titles.previewLabel}](${song.previewUrl})`, true)
			);
		}

		return display;
	}
}

interface ItunesData {
	artistId: number;
	artistName: string;
	artistViewUrl: string;
	artworkUrl100: string;
	artworkUrl30: string;
	artworkUrl60: string;
	collectionCensoredName: string;
	collectionExplicitness: 'explicit' | string;
	collectionId: number;
	collectionName: string;
	collectionPrice: number;
	collectionViewUrl: string;
	country: string;
	currency: string;
	discCount: number;
	discNumber: number;
	isStreamable: boolean;
	kind: 'song' | string;
	previewUrl: string;
	primaryGenreName: string;
	releaseDate: string;
	trackCensoredName: string;
	trackCount: number;
	trackExplicitness: 'notExplicit' | string;
	trackId: number;
	trackName: string;
	trackNumber: number;
	trackPrice: number;
	trackTimeMillis: number;
	trackViewUrl: string;
	wrapperType: 'track' | string;
}

interface AppleItunesResult {
	results: ItunesData[];
	resultCount: number;
}
