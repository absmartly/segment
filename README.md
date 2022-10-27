# A/B Smartly Segment Integration

This is a Lambda function that runs on [Segment](https://www.segment.com)
for A/B Smartly Integration.

It extracts the relevant data from Segment events and sends it, correctly
formatted, to the A/B Smartly Collector endpoint.

It can also be added directly as a destination function on a Segment workspace.

### Configuring a Workspace Destination Function

If you are configuring a destination function on your workspace, these are the necessary settings:

| Name                        | Type    | Required | Javascript                             | Description                                                                                                                                                                                                                                                                                                                                                                                                                             |
|-----------------------------|---------|----------|----------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Collector Endpoint          | String  | yes      | `settings.collectorEndpoint`           | Your dedicated A/B Smartly Collector Endpoint. Example: `https://demo.absmartly.io/v1`                                                                                                                                                                                                                                                                                                                                                  |
| API Key                     | String  | yes      | `settings.apiKey`                      | API Key to use when sending events to the A/B Smartly Collector.<br>API Keys are created in the A/B Smartly Web Console's Settings section.                                                                                                                                                                                                                                                                                              |
| Environment                 | String  | yes      | `settings.environment`                 | The environment name where the events are originating (case sensitive).<br>Environments are created in the A/B Smartly Web Console's Settings section.                                                                                                                                                                                                                                                                                   |
| EnableExposureTracking      | Boolean | no       | `settings.enableExposureTracking`      | Enable sending A/B Smartly exposures to the A/B Smartly Collector.<br>NOTE: Enable this **only** if you instantiate the A/B Smartly SDK with a **custom** publisher and are sending A/B Smartly exposures through Segment.                                                                                                                                                                                                              |
| EnablePageViewTracking      | Boolean | no       | `settings.enablePageViewTracking`      | Enable sending Segment's [Page events](https://segment.com/docs/connections/spec/page/) as goals to the A/B Smartly Collector.<br>NOTE: The goal generated will have the name `Page Viewed: <Page Name>` and needs to have been previously created in the A/B Smartly Web Console's Settings section.<br>WARNING: These events tend to happen very frequently and may increase storage cost.                                            |
| EnableAppScreenViewTracking | Boolean | no       | `settings.enableAppScreenViewTracking` | Enable sending Segment's [Screen events](https://segment.com/docs/connections/spec/screen/) as goals to the A/B Smartly Collector.<br>NOTE: The goal generated will have the name `Screen Viewed: <Screen Name>` for example `Screen Viewed: Login` and needs to have been previously created in the A/B Smartly Web Console's Settings section.<br>WARNING: These events tend to happen very frequently and may increase storage cost. |
| Unit Mapping                | Mapping | yes      | `settings.unitMapping`                 | Mapping of Segment identity to A/B Smartly Unit. Mapping of Segment identity to A/B Smartly Unit. Example `anonymousId` -> `anonymous_uuid`, `userId` -> `user_id`.<br>Units are created in the A/B Smartly Web Console's Settings section.<br>NOTE: This mapping is required, even if the names are exactly the same.                                                                                                                  |
| Goal Mapping                | Mapping | no       | `settings.goalMapping`                 | Mapping of Segment event names to A/B Smartly goal names. If a mapping exists, it will be used, otherwise the original event name will be used as the goal name.                                                                                                                                                                                                                                                                        |

## Advanced Usage

### Sending experiment exposures to Segment

It can be useful to send experiment exposures to Segment for visibility from
other destinations. The Segment spec includes the [`Experiment Viewed`
semantic event](https://segment.com/docs/connections/spec/ab-testing/)
for this purpose.

In the A/B Smartly context, we can
[install a custom event logger](https://docs.absmartly.com/docs/sdk%20documentation/getting-started/#using-a-custom-event-logger)
and send exposures directly to Segment.

```javascript
analytics.ready(function() {
    // initialize ABSmartly SDK
    const sdk = new absmartly.SDK({
        endpoint: 'https://your-absmartly-endpoint.absmartly.io/v1',
        apiKey: '<YOUR-API-KEY>',
        environment: 'development',
        application: 'YOUR-APP',
        eventLogger: (context, eventName, data) => {
            if (eventName == "exposure") {
                // filter only relevant and interesting exposures
                // if the assigned flag is false, this exposure was a treatment call that did not result in an assignment
                // this can happen if, for example, the experiment is no longer running, but treatment() calls are still in the application code
                if (exposure.assigned) {
                    analytics.track("Experiment Viewed", {
                        experiment_id: exposure.id,
                        experiment_name: exposure.name,
                        variation_id: exposure.variant,
                        variation_name: "ABCDEFG"[exposure.variant],
                    });
                }
            }
        },
    });

    const context = sdk.createContext(request);
    context.attribute("user_agent", navigator.userAgent);

    context.ready().then((response) => {
        console.log("ABSmartly Context ready!");
        console.log(context.treatment("test-exp"));
    }).catch((error) => {
        console.log(error);
    });
});
```

### Mapping Segment Identities to A/B Smartly Units

For simple mappings, you can map Segment's identities/properties
to A/B Smartly's units in your A/B Smartly integration settings in Segment.

If you want to programmatically make this mapping, you can install a
middleware in your Segment SDK that will append the units to the
`properties.absmartly.units` field before sending to Segment.
The destination function will extract and use that instead. This may be
useful if you are running A/B Smartly experiment on units that are not
the typical Segment `anonymousId` or `userId`.

```javascript
analytics.ready(function() {
    // example absmartly middle to enrich segment track, page and screen events with relevant
    // absmartly units - useful if you want to run experiments on units that are not your segment users
    const absmartlyMiddleware = function ({payload, next, integrations}) {
        const type = payload.obj.type;
        switch (type) {
            case "track":
            case "page":
            case "screen":
                const event = payload.obj;
                const props = event.properties;

                const units = [];

                // always send the current user's units
                const anonymousId = "anonymousId" in event ? event["anonymousId"] : analytics.user().anonymousId();
                units.push({type: "anonymousId", uid: anonymousId});

                // additionally, if we have any other units, add them
                if (event.userId) {
                    units.push({type: "userId", uid: event.userId});
                }

                // add any additional product units from properties, for example, when running product experiments
                // event will also be assigned to these units in absmartly
                if (props.productId) {
                    units.push({type: "productId", uid: props.productId});
                }

                if (props.products) {
                    for (const product of props.products) {
                        units.push({type: "productId", uid: product.productId});
                    }
                }

                props["absmartly"] = {units};
                break;
            default:
                break;
        }

        next(payload);
    }

    // add it as middleware
    analytics.addSourceMiddleware(absmartlyMiddleware);
});
```


### Publishing Experiment Exposures Through Segment

To publish experiment exposures, you must turn on `EnableExposureTracking`
in your destination settings in Segment.

We want to replace the direct flow of exposure events from the A/B
Smartly SDK to the A/B Smartly collector, by instead sending them to Segment
for processing by the destination function.

This can be achieved by instantiating the A/B Smartly SDK with a custom
context publisher.

The custom publisher will publish an `Experiment Viewed` Segment event
with A/B Smartly's exposure data in the `properties.absmartly` field as well
as the normal semantic data that Segment recommends for this event.

Here is an example in Javascript.

```javascript
analytics.ready(function() {
    // initialize ABSmartly SDK
    const sdk = new absmartly.SDK({
        endpoint: 'https://your-absmartly-endpoint.absmartly.io/v1',
        apiKey: '<YOUR-API-KEY>',
        environment: 'development',
        application: 'YOUR-APP',
    });

    // ABSmartly publisher implementation that publishes ABSmartly exposures to Segment,
    // instead of directly to the ABSmartly Collector
    // these will then be pushed by the ABSmartly segment integration to the ABSmartly collector
    class SegmentContextPublisher extends absmartly.ContextPublisher {
        constructor(segment) {
            super();

            this._segment = segment;
        }

        publish(request, sdk, context) {
            // NOTE: only exposures are expected to come via this route
            // other types of events should be tracked through the Segment API
            if (request.exposures) {
                for (const exposure of request.exposures) {
                    this._segment.track(`Experiment Viewed`, {
                        experiment_id: exposure.id,
                        experiment_name: exposure.name,
                        variation_id: exposure.variant,
                        variation_name: "ABCDEFG"[exposure.variant],
                        absmartly: Object.assign({},
                            {
                                exposures: [exposure],
                            },
                            // add anything else in the a/b smartly payload that are not exposures or goals
                            ...Object.entries(request)
                                .filter(e => (e[0] !== 'exposures') && (e[0] !== 'goals'))
                                .map(e => ({[e[0]]: e[1]}))
                        )
                    });
                }
            }

            return Promise.resolve();
        }
    }

    // set this as the default publisher - all contexts created from now on will use it by default
    sdk.setContextPublisher(new SegmentContextPublisher(analytics));

    const request = {
        units: {
            userId: analytics.user().id(),
            anonymousId: analytics.user().anonymousId(),
        },
    };

    window.context = sdk.createContext(request);
    context.attribute("user_agent", navigator.userAgent);

    context.ready().then((response) => {
        console.log("ABSmartly Context ready!");
        console.log(context.treatment("test-exp"));
    }).catch((error) => {
        console.log(error);
    });
});
```

## Finishing Up

You should now have you A/B Smartly Segment integration fully set up!

If you are looking for more information, feel free to visit
[the docs](https://docs.absmartly.com) or ask a question in your
organization's dedicated A/B Smartly Slack channel.

## About A/B Smartly
A/B Smartly is the leading provider of state-of-the-art, on-premises,
full-stack experimentation platforms for engineering and product teams that
want to confidently deploy features as fast as they can develop them. A/B
Smartly's real-time analytics helps engineering and product teams ensure
that new features will improve the customer experience without breaking
or degrading performance and/or business metrics.

Have a look at our growing list of clients and SDKs:
- [Java SDK](https://github.com/absmartly/java-sdk)
- [JavaScript SDK](https://github.com/absmartly/javascript-sdk)
- [Swift SDK](https://github.com/absmartly/swift-sdk)
- [Vue2 SDK](https://github.com/absmartly/vue2-sdk)
- [Go SDK](https://github.com/absmartly/go-sdk)
- [React SDK](https://github.com/absmartly/react-sdk)
