# A/B Smartly Segment Integration

This is a Lambda function that runs on [Segment](https://www.segment.com) for integration with A/B Smartly.

It extracts the relevant data from Segment events, and sends it correctly formatted to the A/B Smartly Collector endpoint.


## NOTE

If you are a developer from an A/B Smartly customer you don't need this repository, but the following documentation might be useful.


## Mapping identities from Segment to A/B Smartly units

For simple mappings, you can make the mapping of Segment identities/properties to A/B Smartly units directly in your A/B Smartly integration settings in Segment.
If you want to make this mapping programmatically, you can install a middleware in your Segment SDK that will append the units in the `properties.absmartly.units` field before sending to Segment.


## Publishing Exposures through Segment

You can enable exposure tracking in your A/B Smartly integration settings in Segment.

Exposure tracking can be implemented by instantiating the A/B Smartly SDK with a custom context publisher.
The custom publisher will publish a Segment `Group` event with the A/B Smartly exposure data in the `traits.absmartly` field.


## Example

Here is a Javascript example of a custom middleware adding extra units to the event, and a publisher implementation publishing exposures through Segment:

```html
<head>
    <script>
        // YOUR SEGMENT SNIPPET HERE
    </script>
    <script src="https://unpkg.com/@absmartly/javascript-sdk/dist/absmartly.min.js"></script
    <script>
        window.addEventListener('DOMContentLoaded', (e) => {
            analytics.ready(function() {

                // example absmartly middle to enrich segment track, page and screen events with relevant
                // absmartly units - useful if you want to run experiments on units that are not your segment users
                function absmartlyMiddleware({ payload, next, integrations }) {
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
                            units.push({ type: "anonymousId", uid: anonymousId });
                            
                            // additionally, if we have any other units, add them
                            if (event.userId) {
                                units.push({ type: "userId", uid: event.userId });
                            }

                            // add any additional product units from properties, for example, when running product experiments
                            // event will also be assigned to these units in absmartly
                            if (props.productId) {
                                units.push({ type: "productId", uid: props.productId });
                            }

                            if (props.products) {
                                for (const product of props.products) {
                                    units.push({ type: "productId", uid: product.productId });
                                }
                            }

                            props["absmartly"] = { units };
                            break;
                        default:
                            break;
                    }

                    next(payload);
                }

                // add it as middleware
                analytics.addSourceMiddleware(absmartlyMiddleware);


                // initialize ABSmartly SDK
                const sdk = new absmartly.SDK({
                    endpoint: 'https://your-absmartly-endpoint.absmartly.io/v1',
                    apiKey: '<YOUR-API-KEY>',
                    environment: 'development',
                    application: 'YOUR-APP',
                    }
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
                        // only exposures are expected to come via this route
                        // other types of events should be tracked through the Segment api
                        if (request.exposures) {
                            for (const exposure of request.exposures) {
                                this._segment.group(`${exposure.name}:${exposure.variant}`, {
                                    absmartly: Object.assign({},
                                        {
                                            exposures: [exposure],
                                        },
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
        });
    </script>
</head>
```
