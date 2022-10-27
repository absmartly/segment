const fetch = require("node-fetch");
const { Headers } = require("node-fetch");
const InvalidEventPayload = Error;

// --- BEGIN SEGMENT CODE CUT ---

function getJsonValue(json, path) {
	const frags = path.split("/");
	let key = frags.shift();
	while (json !== undefined) {
		if (key in json) {
			json = json[key];

			if (json === null || typeof json !== "object") {
				if (frags.length === 0) {
					break;
				}
			}

			key = frags.shift();
			continue;
		}

		return undefined;
	}

	return json;
}

function isUnit(value) {
	return typeof value === "string" || typeof value === "number";
}

function mapUnits(event, settings) {
	if ("properties" in event && "absmartly" in event.properties) {
		const absmartly = event.properties.absmartly;
		if ("units" in absmartly) {
			delete event.properties.absmartly;
			return absmartly.units;
		}
	}

	return Object.entries(settings.unitMapping)
		.filter(entry => entry[0] in event && isUnit(event[entry[0]]))
		.map(entry => ({
			type: entry[1],
			uid: String(event[entry[0]])
		}));
}

function createGoal(event, settings, name) {
	return [
		{
			name,
			achievedAt: Date.parse(event.originalTimestamp),
			properties: event.properties
		}
	];
}

function mapGoal(event, settings) {
	const name = event.event in settings.goalMapping ? settings.goalMapping[event.event] : event.event;
	return createGoal(event, settings, name);
}

async function sendEvent(data, settings) {
	const res = await fetch(`${settings.collectorEndpoint}/context`, {
		body: JSON.stringify(data),
		headers: new Headers({
			"X-API-Key": settings.apiKey,
			"X-Agent": "segment",
			// "X-Application": settings.application,
			// "X-Application-Version": "0",
			"X-Environment": settings.environment,
			"Content-Type": "application/json"
		}),
		method: "PUT"
	});

	return res.json();
}

async function sendGoalEvent(event, settings, units, goals) {
	return sendEvent(
		{
			publishedAt: Date.parse(event.sentAt),
			units: units,
			goals
			//event,
			//settings,
		},
		settings
	);
}

async function onTrack(event, settings) {
	if (event.event === "Experiment Viewed") {
		if (settings.enableExposureTracking) {
			if ("properties" in event && "absmartly" in event.properties) {
				return sendEvent(event.properties.absmartly, settings);
			}
		}

		return undefined;
	}

	const goal = mapGoal(event, settings);
	if (goal != null && goal.length > 0) {
		const units = mapUnits(event, settings);
		if (units != null && units.length > 0) {
			return sendGoalEvent(event, settings, units, goal);
		}
	}
	return undefined;
}

async function onPage(event, settings) {
	if (settings.enablePageViewTracking) {
		if (typeof event.name !== "string") {
			throw InvalidEventPayload("Page event requires page name.");
		}

		const goal = createGoal(event, settings, `Page: ${event.name}`);
		if (goal != null && goal.length > 0) {
			const units = mapUnits(event, settings);
			if (units != null && units.length > 0) {
				return sendGoalEvent(event, settings, units, goal);
			}
		}
	}
	return undefined;
}

async function onScreen(event, settings) {
	if (settings.enableAppScreenViewTracking) {
		if (typeof event.name !== "string") {
			throw InvalidEventPayload("Screen event requires screen name.");
		}

		const goal = createGoal(event, settings, `Screen: ${event.name}`);
		if (goal != null && goal.length > 0) {
			const units = mapUnits(event, settings);
			if (units != null && units.length > 0) {
				return sendGoalEvent(event, settings, units, goal);
			}
		}
	}
	return undefined;
}

// deprecated method of sending exposures through segment
async function onGroup(event, settings) {
	if (settings.enableExposureTracking) {
		if ("traits" in event && "absmartly" in event.traits) {
			return sendEvent(event.traits.absmartly, settings);
		}
	}
	return undefined;
}

// --- END OF SEGMENT CODE CUT ---

module.exports = {
	getJsonValue,
	mapGoal,
	mapUnits,
	onGroup,
	onPage,
	onScreen,
	onTrack
};
