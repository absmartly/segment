module.exports = function (api) {
	api.cache.never();

	const presets = [];
	const plugins = [
		"@babel/plugin-syntax-dynamic-import",
		"@babel/plugin-syntax-import-meta",
		"@babel/plugin-proposal-class-properties",
		"@babel/plugin-proposal-json-strings",
		[
			"@babel/plugin-proposal-decorators",
			{
				legacy: true
			}
		],
		"@babel/plugin-proposal-function-sent",
		"@babel/plugin-proposal-export-namespace-from",
		"@babel/plugin-proposal-numeric-separator",
		"@babel/plugin-proposal-throw-expressions",
		"@babel/plugin-proposal-export-default-from",
		"@babel/plugin-proposal-logical-assignment-operators",
		"@babel/plugin-proposal-optional-chaining",
		[
			"@babel/plugin-proposal-pipeline-operator",
			{
				proposal: "minimal"
			}
		],
		"@babel/plugin-proposal-nullish-coalescing-operator",
		"@babel/plugin-proposal-do-expressions",
		"@babel/plugin-proposal-function-bind"
	];

	const presetEnv = [
		"@babel/preset-env",
		{
			useBuiltIns: false,
			modules: "commonjs", // transpile modules into common-js syntax by default
			targets: {
				node: 14
			}
		}
	];

	const transformRuntime = [
		"@babel/plugin-transform-runtime",
		{
			useESModules: false, // don't output es-modules by default
			corejs: false,
			helpers: false
		}
	];

	presets.push(presetEnv);
	plugins.push(transformRuntime);

	return {
		presets,
		plugins
	};
};
