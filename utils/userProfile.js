/* eslint-disable no-underscore-dangle, complexity, no-throw-literal */
module.exports = class UserProfile {
  constructor(user) {
    Object.defineProperty(this, "client", { value: user.client });
    Object.defineProperty(this, "user", { value: user });
    Object.defineProperty(this, "_profile", { value: this.client.cacheProfiles.get(user.id) || {} });
    Object.defineProperty(this, "timeDaily", { value: this._profile.timeDaily || 0 });
    Object.defineProperty(this._profile, "banners", { value: this._profile.banners || {} });
    Object.defineProperty(this, "timerep", { value: this._profile.timerep || 0 });
    Object.defineProperty(this, "lastUpdate", { value: this._profile.time || 0 });
    this.id = user.id;
    this.points = this._profile.points || 0;
    this.color = this._profile.color || "ff239d";
    this.money = this._profile.money || 0;
    this.reputation = this._profile.reputation || 0;
    this.quote = this._profile.quote || null;
    this.banners = {};
    this.banners.theme = this._profile.banners.theme || "0001";
    this.banners.level = this._profile.banners.level || "1001";
  }

  get exists() {
    return this.client.cacheProfiles.has(this.id);
  }

  async create() {
    if (this.exists) throw "This UserProfile already exists.";
    new this.client.Create(this.client).CreateUser(this.id).catch((e) => { throw e; });
  }

  async ensureProfile() {
    if (!this.exists) new this.client.Create(this.client).CreateUser(this.id).catch((e) => { throw e; });
  }

  async sync() {
    const data = await this.client.rethink.get("users", this.id);
    if (!data) throw "[404] Not found.";
    if (this.exists) this.client.cacheProfiles.delete(this.id);
    this.client.cacheProfiles.set(this.id, data);
  }

  async destroy() {
    if (!this.exists) throw "This UserProfile does not exist.";
    await this.client.rethink.delete("users", this.id);
    this.client.cacheProfiles.delete(this.id);
  }
};
