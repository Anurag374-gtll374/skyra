import { LanguageKeys } from '#lib/i18n/languageKeys';
import { SkyraCommand } from '#lib/structures';
import { OWNERS, SISTER_CLIENTS } from '#root/config';
import { assetsFolder } from '#utils/constants';
import { fetchAvatar, radians } from '#utils/util';
import { ApplyOptions } from '@sapphire/decorators';
import { send } from '@sapphire/plugin-editable-commands';
import { Canvas, Image, resolveImage } from 'canvas-constructor/skia';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import type { Message, User } from 'discord.js';
import { join } from 'node:path';

@ApplyOptions<SkyraCommand.Options>({
	description: LanguageKeys.Commands.Misc.SlapDescription,
	detailedDescription: LanguageKeys.Commands.Misc.SlapExtended,
	requiredClientPermissions: [PermissionFlagsBits.AttachFiles],
	spam: true
})
export class UserCommand extends SkyraCommand {
	private kTemplate: Image = null!;
	private readonly reflectedUsers = OWNERS.concat(SISTER_CLIENTS).concat(process.env.CLIENT_ID);

	public async messageRun(message: Message, args: SkyraCommand.Args) {
		const user = await args.pick('userName');
		const attachment = await this.generate(message, user);
		return send(message, { files: [{ attachment, name: 'slap.png' }] });
	}

	public async generate(message: Message, possibleTarget: User) {
		const { target, user } = this.resolve(message, possibleTarget);
		const [robin, batman] = await Promise.all([fetchAvatar(target, 256), fetchAvatar(user, 256)]);

		/* Initialize Canvas */
		return (
			new Canvas(950, 475)
				.printImage(this.kTemplate, 0, 0, 950, 475)

				// Draw Batman
				.save()
				.setTransform(-1, 0, 0, 1, 476, 173)
				.rotate(radians(-13.96))
				.printCircularImage(batman, 0, 0, 79)
				.restore()

				// Draw Robin
				.translate(244, 265)
				.rotate(radians(-24.53))
				.printCircularImage(robin, 0, 0, 93)

				// Draw the buffer
				.png()
		);
	}

	public async onLoad() {
		this.kTemplate = await resolveImage(join(assetsFolder, './images/memes/slap.png'));
	}

	private resolve(message: Message, possibleTarget: User) {
		const targetSelf = possibleTarget.id === message.author.id;
		if (targetSelf) {
			if (!OWNERS.includes(message.author.id)) return { target: message.author, user: this.container.client.user! };
			this.error(LanguageKeys.Commands.Misc.CannotTargetOwner);
		}

		if (this.reflectedUsers.includes(possibleTarget.id)) return { target: message.author, user: possibleTarget };
		return { target: possibleTarget, user: message.author };
	}
}
