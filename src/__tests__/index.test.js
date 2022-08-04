const fetch = require("node-fetch");
const { Headers } = require("node-fetch");
const { getJsonValue, mapUnits, onGroup, onPage, onScreen, onTrack } = require("../index");

jest.mock("node-fetch");

const settings = {
	collectorEndpoint: "https://sandbox.absmartly.io/v1",
	apiKey: "testapikey",
	//	application: "website",
	environment: "production",
	goalMapping: {
		payment: "payment",
		signup: "signup"
	},
	unitMapping: {
		anonymousId: "anonymous_id",
		email: "email",
		userId: "user_id"
	},
	enablePageViewTracking: true,
	enableAppScreenViewTracking: true,
	enableExposureTracking: true
};

const defaultPaymentEvent = {
	anonymousId: "477f0fc8-84d0-47f8-9c01-705245bf728d",
	channel: "client",
	event: "payment",
	messageId: "ajs-next-a8465170-0fb1-422e-b9d8-a1f53c3953af",
	originalTimestamp: "2021-03-29T12:30:42.261Z",
	projectId: "bsgAGbS6bJF3ksyfogWfag",
	properties: {
		fee: 1000,
		value: 10000,
		ignored: 9
	},
	receivedAt: "2021-03-29T12:30:42.732Z",
	sentAt: "2021-03-29T12:30:42.261Z",
	timestamp: "2021-03-29T12:30:42.732Z",
	type: "track",
	userId: "12345",
	version: 2
};

const defaultPageEvent = {
	anonymousId: "477f0fc8-84d0-47f8-9c01-705245bf728d",
	channel: "client",
	name: "Home",
	messageId: "ajs-next-a8465170-0fb1-422e-b9d8-a1f53c3953af",
	originalTimestamp: "2021-03-29T12:30:42.261Z",
	projectId: "bsgAGbS6bJF3ksyfogWfag",
	properties: {
		title: "Home Page"
	},
	receivedAt: "2021-03-29T12:30:42.732Z",
	sentAt: "2021-03-29T12:30:42.261Z",
	timestamp: "2021-03-29T12:30:42.732Z",
	type: "page",
	userId: "12345",
	version: 2
};

const defaultScreenEvent = {
	anonymousId: "477f0fc8-84d0-47f8-9c01-705245bf728d",
	channel: "client",
	name: "Home",
	messageId: "ajs-next-a8465170-0fb1-422e-b9d8-a1f53c3953af",
	originalTimestamp: "2021-03-29T12:30:42.261Z",
	projectId: "bsgAGbS6bJF3ksyfogWfag",
	properties: {
		title: "Home Screen"
	},
	receivedAt: "2021-03-29T12:30:42.732Z",
	sentAt: "2021-03-29T12:30:42.261Z",
	timestamp: "2021-03-29T12:30:42.732Z",
	type: "screen",
	userId: "12345",
	version: 2
};

const defaultGroupEvent = {
	anonymousId: "477f0fc8-84d0-47f8-9c01-705245bf728d",
	channel: "client",
	groupId: "test_experiment:0",
	messageId: "ajs-next-a8465170-0fb1-422e-b9d8-a1f53c3953af",
	originalTimestamp: "2021-03-29T12:30:42.261Z",
	projectId: "bsgAGbS6bJF3ksyfogWfag",
	traits: {
		absmartly: {
			exposures: [
				{
					id: 0,
					name: "test_experiment",
					unit: null,
					exposedAt: 1623508467556,
					variant: 0,
					assigned: false,
					eligible: true,
					overridden: false,
					fullOn: false
				}
			],
			publishedAt: 1623508467657,
			units: [
				{
					type: "userId",
					uid: "gnzLDuqKcGxMNKFokfhOew"
				},
				{
					type: "anonymousId",
					uid: "puTh5EeqBvPN4FjqKfQK2A"
				}
			],
			hashed: true,
			attributes: [
				{
					name: "user_agent",
					value:
						"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.101 Safari/537.36",
					setAt: 1623508467551
				}
			]
		}
	},
	receivedAt: "2021-03-29T12:30:42.732Z",
	sentAt: "2021-03-29T12:30:42.261Z",
	timestamp: "2021-03-29T12:30:42.732Z",
	type: "group",
	userId: "12345",
	version: 2
};

const defaultJsonResponse = { ok: true };

const expectedHeaders = {
	"X-API-Key": settings.apiKey,
	"X-Agent": "segment",
	// "X-Application": settings.application,
	// "X-Application-Version": "0",
	"X-Environment": settings.environment,
	"Content-Type": "application/json"
};

function responseMock(statusCode, statusText, response) {
	return {
		ok: statusCode >= 200 && statusCode <= 299,
		status: statusCode,
		statusText,
		text: () => Promise.resolve(response),
		json: () => Promise.resolve(JSON.parse(JSON.stringify(response)))
	};
}

describe("mapUnits()", () => {
	it("should skip invalid units", async done => {
		const paymentEvent = {
			...defaultPaymentEvent,
			userId: null,
			email: undefined
		};

		const units = mapUnits(paymentEvent, settings);
		expect(units).toEqual([{ type: "anonymous_id", uid: "477f0fc8-84d0-47f8-9c01-705245bf728d" }]);

		done();
	});

	it("should use 'absmartly' units if available", async done => {
		const paymentEvent = {
			...defaultPaymentEvent,

			properties: {
				...defaultPaymentEvent.properties,
				absmartly: {
					units: [
						{ type: "anonymousId", uid: "a99f0fc8-84d0-47f8-9c01-705245bf888b" },
						{ type: "userId", uid: "4352" }
					]
				}
			}
		};

		const units = mapUnits(paymentEvent, settings);
		expect(units).toEqual([
			{ type: "anonymousId", uid: "a99f0fc8-84d0-47f8-9c01-705245bf888b" },
			{ type: "userId", uid: "4352" }
		]);

		done();
	});
});

describe("onTrack()", () => {
	it("should map 'absmartly' units if present", async done => {
		const realFetch = jest.requireActual("node-fetch");

		fetch.mockResolvedValue(responseMock(200, "OK", defaultJsonResponse));
		Headers.mockImplementation((...args) => new realFetch.Headers(...args));

		const result = await onTrack(
			{
				...defaultPaymentEvent,
				properties: {
					...defaultPaymentEvent.properties,
					absmartly: {
						units: [{ type: "userId", uid: "4312" }]
					}
				}
			},
			settings
		);

		expect(Headers).toHaveBeenCalledTimes(1);
		expect(Headers).toHaveBeenCalledWith(expectedHeaders);

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenLastCalledWith(`${settings.collectorEndpoint}/context`, {
			body: JSON.stringify({
				publishedAt: 1617021042261,
				units: [{ type: "userId", uid: "4312" }],
				goals: [
					{
						name: "payment",
						achievedAt: 1617021042261,
						properties: {
							fee: 1000,
							value: 10000,
							ignored: 9
						}
					}
				]
			}),
			headers: new Headers(expectedHeaders),
			method: "PUT"
		});
		expect(result).toEqual(defaultJsonResponse);

		done();
	});

	it("should map goal name", async done => {
		const realFetch = jest.requireActual("node-fetch");

		fetch.mockResolvedValue(responseMock(200, "OK", defaultJsonResponse));
		Headers.mockImplementation((...args) => new realFetch.Headers(...args));

		const result = await onTrack(defaultPaymentEvent, settings);

		expect(Headers).toHaveBeenCalledTimes(1);
		expect(Headers).toHaveBeenCalledWith(expectedHeaders);

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenLastCalledWith(`${settings.collectorEndpoint}/context`, {
			body: JSON.stringify({
				publishedAt: 1617021042261,
				units: [
					{ type: "anonymous_id", uid: "477f0fc8-84d0-47f8-9c01-705245bf728d" },
					{ type: "user_id", uid: "12345" }
				],
				goals: [
					{
						name: "payment",
						achievedAt: 1617021042261,
						properties: {
							fee: 1000,
							value: 10000,
							ignored: 9
						}
					}
				]
			}),
			headers: new Headers(expectedHeaders),
			method: "PUT"
		});
		expect(result).toEqual(defaultJsonResponse);

		done();
	});

	it("should pass through unmapped goal name", async done => {
		const realFetch = jest.requireActual("node-fetch");

		fetch.mockResolvedValue(responseMock(200, "OK", defaultJsonResponse));
		Headers.mockImplementation((...args) => new realFetch.Headers(...args));

		const result = await onTrack({ ...defaultPaymentEvent, event: "unmapped" }, settings);

		expect(Headers).toHaveBeenCalledTimes(1);
		expect(Headers).toHaveBeenCalledWith(expectedHeaders);

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenLastCalledWith(`${settings.collectorEndpoint}/context`, {
			body: JSON.stringify({
				publishedAt: 1617021042261,
				units: [
					{ type: "anonymous_id", uid: "477f0fc8-84d0-47f8-9c01-705245bf728d" },
					{ type: "user_id", uid: "12345" }
				],
				goals: [
					{
						name: "unmapped",
						achievedAt: 1617021042261,
						properties: {
							fee: 1000,
							value: 10000,
							ignored: 9
						}
					}
				]
			}),
			headers: new Headers(expectedHeaders),
			method: "PUT"
		});
		expect(result).toEqual(defaultJsonResponse);

		done();
	});

	it("should ignore non numeric properties", async done => {
		const realFetch = jest.requireActual("node-fetch");

		fetch.mockResolvedValue(responseMock(200, "OK", defaultJsonResponse));
		Headers.mockImplementation((...args) => new realFetch.Headers(...args));

		const result = await onTrack(
			{
				...defaultPaymentEvent,
				properties: {
					flt: 1.5,
					int: 100,
					str: "156",
					bool: true,
					obj: {
						str: "abc",
						int: 999
					},
					omitted: {
						str: "ignored"
					}
				}
			},
			settings
		);

		expect(Headers).toHaveBeenCalledTimes(1);
		expect(Headers).toHaveBeenCalledWith(expectedHeaders);

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenLastCalledWith(`${settings.collectorEndpoint}/context`, {
			body: JSON.stringify({
				publishedAt: 1617021042261,
				units: [
					{ type: "anonymous_id", uid: "477f0fc8-84d0-47f8-9c01-705245bf728d" },
					{ type: "user_id", uid: "12345" }
				],
				goals: [
					{
						name: "payment",
						achievedAt: 1617021042261,
						properties: {
							flt: 1.5,
							int: 100,
							obj: {
								int: 999
							}
						}
					}
				]
			}),
			headers: new Headers(expectedHeaders),
			method: "PUT"
		});
		expect(result).toEqual(defaultJsonResponse);

		done();
	});

	it("should do nothing when no units present", async done => {
		const result = await onTrack(
			{
				...defaultPaymentEvent,
				properties: {
					absmartly: {
						units: []
					}
				}
			},
			settings
		);

		expect(Headers).toHaveBeenCalledTimes(0);
		expect(fetch).toHaveBeenCalledTimes(0);
		expect(result).toBe(undefined);

		done();
	});
});

describe("onGroup()", () => {
	it("should pass through 'absmartly' event unmodified", async done => {
		const realFetch = jest.requireActual("node-fetch");

		fetch.mockResolvedValue(responseMock(200, "OK", defaultJsonResponse));
		Headers.mockImplementation((...args) => new realFetch.Headers(...args));

		const result = await onGroup(defaultGroupEvent, settings);

		expect(Headers).toHaveBeenCalledTimes(1);
		expect(Headers).toHaveBeenCalledWith(expectedHeaders);

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenLastCalledWith(`${settings.collectorEndpoint}/context`, {
			body: JSON.stringify(defaultGroupEvent.traits.absmartly),
			headers: new Headers(expectedHeaders),
			method: "PUT"
		});
		expect(result).toEqual(defaultJsonResponse);

		done();
	});

	it("should do nothing when not an 'absmartly' event", async done => {
		const result = await onGroup(
			{
				...defaultGroupEvent,
				traits: {
					name: "group name"
				}
			},
			settings
		);

		expect(Headers).toHaveBeenCalledTimes(0);
		expect(fetch).toHaveBeenCalledTimes(0);
		expect(result).toBe(undefined);

		done();
	});

	it("should do nothing when disabled", async done => {
		const result = await onGroup(defaultPageEvent, {
			...settings,
			enableExposureTracking: false
		});

		expect(Headers).toHaveBeenCalledTimes(0);
		expect(fetch).toHaveBeenCalledTimes(0);
		expect(result).toBe(undefined);

		done();
	});
});

describe("onPage()", () => {
	it("should map 'absmartly' units if present", async done => {
		const realFetch = jest.requireActual("node-fetch");

		fetch.mockResolvedValue(responseMock(200, "OK", defaultJsonResponse));
		Headers.mockImplementation((...args) => new realFetch.Headers(...args));

		const result = await onPage(
			{
				...defaultPageEvent,
				properties: {
					...defaultPageEvent.properties,
					absmartly: {
						units: [{ type: "userId", uid: "4312" }]
					}
				}
			},
			settings
		);

		expect(Headers).toHaveBeenCalledTimes(1);
		expect(Headers).toHaveBeenCalledWith(expectedHeaders);

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenLastCalledWith(`${settings.collectorEndpoint}/context`, {
			body: JSON.stringify({
				publishedAt: 1617021042261,
				units: [{ type: "userId", uid: "4312" }],
				goals: [
					{
						name: "home_pageview",
						achievedAt: 1617021042261,
						properties: {}
					}
				]
			}),
			headers: new Headers(expectedHeaders),
			method: "PUT"
		});
		expect(result).toEqual(defaultJsonResponse);

		done();
	});

	it("should map goal name", async done => {
		const realFetch = jest.requireActual("node-fetch");

		fetch.mockResolvedValue(responseMock(200, "OK", defaultJsonResponse));
		Headers.mockImplementation((...args) => new realFetch.Headers(...args));

		const result = await onPage(defaultPageEvent, settings);

		expect(Headers).toHaveBeenCalledTimes(1);
		expect(Headers).toHaveBeenCalledWith(expectedHeaders);

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenLastCalledWith(`${settings.collectorEndpoint}/context`, {
			body: JSON.stringify({
				publishedAt: 1617021042261,
				units: [
					{ type: "anonymous_id", uid: "477f0fc8-84d0-47f8-9c01-705245bf728d" },
					{ type: "user_id", uid: "12345" }
				],
				goals: [
					{
						name: "home_pageview",
						achievedAt: 1617021042261,
						properties: {}
					}
				]
			}),
			headers: new Headers(expectedHeaders),
			method: "PUT"
		});
		expect(result).toEqual(defaultJsonResponse);

		done();
	});

	it("should do nothing when disabled", async done => {
		const result = await onPage(defaultPageEvent, {
			...settings,
			enablePageViewTracking: false
		});

		expect(Headers).toHaveBeenCalledTimes(0);
		expect(fetch).toHaveBeenCalledTimes(0);
		expect(result).toBe(undefined);

		done();
	});

	it("should throw when name not in event", async done => {
		expect(
			onPage(
				{ ...defaultPageEvent, name: undefined },
				{
					...settings
				}
			)
		)
			.rejects.toThrow("Page event requires page name.")
			.then(done);
	});
});

describe("onScreen()", () => {
	it("should map 'absmartly' units if present", async done => {
		const realFetch = jest.requireActual("node-fetch");

		fetch.mockResolvedValue(responseMock(200, "OK", defaultJsonResponse));
		Headers.mockImplementation((...args) => new realFetch.Headers(...args));

		const result = await onScreen(
			{
				...defaultScreenEvent,
				properties: {
					...defaultScreenEvent.properties,
					absmartly: {
						units: [{ type: "userId", uid: "4312" }]
					}
				}
			},
			settings
		);

		expect(Headers).toHaveBeenCalledTimes(1);
		expect(Headers).toHaveBeenCalledWith(expectedHeaders);

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenLastCalledWith(`${settings.collectorEndpoint}/context`, {
			body: JSON.stringify({
				publishedAt: 1617021042261,
				units: [{ type: "userId", uid: "4312" }],
				goals: [
					{
						name: "home_screenview",
						achievedAt: 1617021042261,
						properties: {}
					}
				]
			}),
			headers: new Headers(expectedHeaders),
			method: "PUT"
		});
		expect(result).toEqual(defaultJsonResponse);

		done();
	});

	it("should map goal name", async done => {
		const realFetch = jest.requireActual("node-fetch");

		fetch.mockResolvedValue(responseMock(200, "OK", defaultJsonResponse));
		Headers.mockImplementation((...args) => new realFetch.Headers(...args));

		const result = await onScreen(defaultScreenEvent, settings);

		expect(Headers).toHaveBeenCalledTimes(1);
		expect(Headers).toHaveBeenCalledWith(expectedHeaders);

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenLastCalledWith(`${settings.collectorEndpoint}/context`, {
			body: JSON.stringify({
				publishedAt: 1617021042261,
				units: [
					{ type: "anonymous_id", uid: "477f0fc8-84d0-47f8-9c01-705245bf728d" },
					{ type: "user_id", uid: "12345" }
				],
				goals: [
					{
						name: "home_screenview",
						achievedAt: 1617021042261,
						properties: {}
					}
				]
			}),
			headers: new Headers(expectedHeaders),
			method: "PUT"
		});
		expect(result).toEqual(defaultJsonResponse);

		done();
	});

	it("should do nothing when disabled", async done => {
		const result = await onScreen(defaultScreenEvent, {
			...settings,
			enableAppScreenViewTracking: false
		});

		expect(Headers).toHaveBeenCalledTimes(0);
		expect(fetch).toHaveBeenCalledTimes(0);
		expect(result).toBe(undefined);

		done();
	});

	it("should throw when name not in event", async done => {
		expect(
			onScreen(
				{ ...defaultScreenEvent, name: undefined },
				{
					...settings
				}
			)
		)
			.rejects.toThrow("Screen event requires screen name.")
			.then(done);
	});
});

describe("getJsonValue()", () => {
	it("should get shallow key", done => {
		expect(getJsonValue({ mykey: 1 }, "mykey")).toEqual(1);
		done();
	});

	it("should get deep key", done => {
		expect(getJsonValue({ mykey: { key: { another: 5 } } }, "mykey/key/another")).toEqual(5);
		done();
	});

	it("should return undefined on missing key", done => {
		expect(getJsonValue({ mykey: 1 }, "missingkey")).toBe(undefined);
		expect(getJsonValue({ mykey: 1 }, "missingkey/key")).toBe(undefined);
		expect(getJsonValue({ mykey: 1 }, "missingkey/key/key")).toBe(undefined);
		done();
	});

	it("should return undefined on non-object non-terminal key", done => {
		expect(getJsonValue({ mykey: { key: 1 } }, "missingkey/key/key")).toBe(undefined);
		expect(getJsonValue({ mykey: { key: null } }, "missingkey/key/key")).toBe(undefined);
		done();
	});
});
