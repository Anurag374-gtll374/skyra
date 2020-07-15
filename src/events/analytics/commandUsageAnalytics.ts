import { Point } from '@influxdata/influxdb-client';
import { Events } from '@lib/types/Enums';
import { ApplyOptions } from '@skyra/decorators';
import { AnalyticsSchema } from '@utils/Tracking/Analytics/AnalyticsSchema';
import { AnalyticsEvent } from '@utils/Tracking/Analytics/structures/AnalyticsEvent';
import { EventOptions } from 'klasa';

@ApplyOptions<EventOptions>({
	event: Events.CommandUsageAnalytics
})
export default class extends AnalyticsEvent {

	public run(commandName: string, category: string, subCategory: string) {
		const command = new Point(AnalyticsSchema.Points.Commands)
			.tag(AnalyticsSchema.Tags.Action, AnalyticsSchema.Actions.Addition)
			.tag(AnalyticsSchema.CommandTags.Category, category)
			.tag(AnalyticsSchema.CommandTags.SubCategory, subCategory)
			.intField(commandName, 1);

		return this.writePoint(command);
	}

}