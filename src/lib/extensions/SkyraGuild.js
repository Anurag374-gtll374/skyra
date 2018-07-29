const { Structures, Collection } = require('discord.js');
const GuildSecurity = require('../util/GuildSecurity');
const StarboardManager = require('../structures/StarboardManager');

const kUnknownMember = Symbol('UnknownMember');

module.exports = Structures.extend('Guild', Guild => {
	/**
	 * Skyra's Extended Guild
	 * @extends {Guild}
	 */
	class SkyraGuild extends Guild {

		/**
		 * @param {...*} args Normal D.JS Guild args
		 */
		constructor(...args) {
			super(...args);

			/**
			 * The GuildSecurity class in charge of processing
			 * @since 3.0.0
			 * @type {GuildSecurity}
			 */
			this.security = new GuildSecurity(this);

			/**
			 * The StarboardManager instance in charge of managing the starred messages
			 * @since 3.0.0
			 * @type {StarboardManager}
			 */
			this.starboard = new StarboardManager(this);

			/**
			 * The name dictionary for this guild
			 * @since 3.2.0
			 * @name SkyraGuild#nameDictionary
			 * @type {Collection<string, string>}
			 */
			Object.defineProperty(this, 'nameDictionary', { value: new Collection() });
		}

		/**
		 * Fetch an user's username by its id
		 * @since 3.2.0
		 * @param {string} id The ID to fetch
		 * @returns {Promise<string>}
		 */
		async fetchName(id) {
			const result = this.nameDictionary.get(id) || await this.members.fetch(id).then(({ displayName }) => {
				this.nameDictionary.set(id, displayName);
				return displayName;
			}).catch(() => {
				this.nameDictionary.set(id, kUnknownMember);
				return kUnknownMember;
			});
			return result === kUnknownMember ? null : result;
		}

	}

	return SkyraGuild;
});
