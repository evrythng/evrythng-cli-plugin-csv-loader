const { execSync } = require('child_process');
const evrythng = require('evrythng');
const fs = require('fs');
const util = require('./modules/util');
const platform = require('./modules/platform');
const stats = require('./modules/stats');
const mapper = require('./modules/mapper');

/** Schema for config files */
const CONFIG_SCHEMA = require(`${__dirname}/schema/config.schema.json`);
/** Example config file directory when using 'init' */
const EXAMPLE_CONFIG_DIR = 'pmd-loader-config';
/** Example config file */
const EXAMPLE_CONFIG = {
  input: {
    schema: `./${EXAMPLE_CONFIG_DIR}/input.schema.json`,
  },
  output: {
    schema: `./${EXAMPLE_CONFIG_DIR}/output.schema.json`,
    mapping: `./${EXAMPLE_CONFIG_DIR}/mapping.json`,
    type: 'product',
    updateKey: 'name',
    projectName: '',
  },
};
/** Example input schema */
const EXAMPLE_INPUT_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  additionalProperties: false,
  required: ['ProductName', 'BatchId', 'ColorCode'],
  properties: {
    ProductName: { type: 'string' },
    BatchId: { type: 'string' },
    ColorCode: { type: 'string' },
  },
};
/** Example output schema */
const EXAMPLE_OUTPUT_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  additionalProperties: false,
  required: ['name', 'tags', 'customFields'],
  properties: {
    name: { type: 'string' },
    tags: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
    },
    customFields: {
      additionalProperties: false,
      required: ['colorCode'],
      properties: {
        colorCode: { type: 'string' },
      },
    },
  },
};
/** Example mapping file */
const EXAMPLE_MAPPING = {
  ProductName: 'name',
  BatchId: 'tags[0]',
  ColorCode: 'customFields.colorCode',
};

let cli;

/**
 * Write the stats object to file.
 *
 * @param {object} config - The config.
 * @param {string} csvPath - The CSV file path.
 */
const writeStatsFile = (config, csvPath) => {
  let outputStr = `Loaded ${csvPath} on ${new Date().toISOString()}\n`;
  outputStr += `\nOK: ${stats.success}\n\nFailed: ${stats.failed}\n`;
  if (stats.errors.length) {
    outputStr += `\nErrors:`;
    stats.errors.forEach((p) => {
      outputStr += `\n${p}`;
    });
  }

  fs.writeFileSync(config.statsFile, outputStr, 'utf8');
};

/**
 * Create an Operator scope using the provided API key.
 *
 * @returns {Promise} Promise that resolves to the initialised Operator scope.
 */
const getOperator = async () => {
  const config = cli.getConfig();

  const operators = config.get('operators');
  const { region, apiKey } = operators[config.get('using')];
  evrythng.setup({ apiUrl: config.get('regions')[region] });

  const operator = new evrythng.Operator(apiKey);
  await operator.init();
  return operator;
};

/**
 * Load data from the specified file.
 *
 * @param {string} configPath - Path to the nominated config file.
 * @param {string} csvPath - The CSV file path.
 */
const load = async (configPath, csvPath) => {
  let config;

  try {
    config = util.loadFile(configPath);
    util.validate(CONFIG_SCHEMA, config, configPath);

    // Initialise EVRYTHNG scope and project
    const operator = await getOperator();
    const project = await platform.loadProject(operator, config);

    // Load and validate CSV file data
    const inputSchema = util.loadFile(config.input.schema);
    const inputData = util.loadFile(csvPath, false);
    const csvRecords = await util.loadCsvRecords(inputData, inputSchema);

    // Map records to EVRYTHNG resources
    const mapping = util.loadFile(config.output.mapping);
    const resources = csvRecords.map(p => mapper.mapRecordToResource(p, mapping));

    // Apply changes
    const outputSchema = util.loadFile(config.output.schema);
    await platform.upsertAllResources(operator, config, resources, project, outputSchema);

    console.log(`\nComplete!`);
  } catch (e) {
    console.log(e);
    stats.errors.push(e.message || e.errors[0]);
  }

  writeStatsFile(config, csvPath);
};

/**
 * Create example config and schema files.
 */
const writeExampleFiles = () => {
  execSync(`mkdir -p ./${EXAMPLE_CONFIG_DIR}`);
  fs.writeFileSync(
    `./${EXAMPLE_CONFIG_DIR}/config.json`,
    JSON.stringify(EXAMPLE_CONFIG, null, 2),
    'utf8',
  );
  fs.writeFileSync(
    `./${EXAMPLE_CONFIG_DIR}/input.schema.json`,
    JSON.stringify(EXAMPLE_INPUT_SCHEMA, null, 2),
    'utf8',
  );
  fs.writeFileSync(
    `./${EXAMPLE_CONFIG_DIR}/output.schema.json`,
    JSON.stringify(EXAMPLE_OUTPUT_SCHEMA, null, 2),
    'utf8',
  );
  fs.writeFileSync(
    `./${EXAMPLE_CONFIG_DIR}/mapping.json`,
    JSON.stringify(EXAMPLE_MAPPING, null, 2),
    'utf8',
  );
  console.log(`Wrote example config files to ./${EXAMPLE_CONFIG_DIR}`);
};

/**
 * Export to CLI.
 *
 * @param {object} api - EVRYTHNG CLI API.
 */
module.exports = (api) => {
  cli = api;

  const newCommand = {
    about: 'Validate, map, create, and update resources from a CSV file.',
    firstArg: 'pmd-loader',
    operations: {
      init: {
        execute: async () => writeExampleFiles(),
        pattern: 'init',
      },
      load: {
        execute: async ([, configPath, csvPath]) => load(configPath, csvPath),
        pattern: 'load $configPath $csvPath',
      },
    },
  };

  api.registerCommand(newCommand);
};
