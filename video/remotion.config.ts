import { Config } from '@remotion/cli/config';

Config.overrideWebpackConfig((currentConfiguration) => {
  const rules = currentConfiguration.module?.rules ?? [];

  const updatedRules = rules.map((rule) => {
    if (
      rule &&
      typeof rule === 'object' &&
      'test' in rule &&
      rule.test instanceof RegExp &&
      rule.test.toString().includes('css')
    ) {
      return {
        ...rule,
        use: [
          ...(Array.isArray(rule.use) ? rule.use : []),
          'postcss-loader',
        ],
      };
    }
    return rule;
  });

  return {
    ...currentConfiguration,
    module: {
      ...currentConfiguration.module,
      rules: updatedRules,
    },
  };
});
