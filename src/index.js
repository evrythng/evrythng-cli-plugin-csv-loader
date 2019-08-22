const {execSync} = require('child_process');
const evrythng = require('evrythng');
const fs = require('fs');
const util = require('./modules/util');
const platform = require('./modules/platform');
const mapper = require('./modules/mapper');
const log = require('./modules/log').log;

const DEFAULT_SHORT_DOMAIN = 'tn.gg';
/** Schema for config files */
const CONFIG_SCHEMA = require(`${__dirname}/schema/config.schema.json`);
/** Example config file directory when using 'init' */
const EXAMPLE_CONFIG_DIR = 'csv-loader-config';
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
        ProductName: {type: 'string'},
        BatchId: {type: 'string'},
        ColorCode: {type: 'string'},
    },
};
/** Example output schema */
const EXAMPLE_OUTPUT_SCHEMA = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    additionalProperties: false,
    required: ['name', 'tags', 'customFields'],
    properties: {
        name: {type: 'string'},
        tags: {
            type: 'array',
            items: {type: 'string'},
            minItems: 1,
        },
        customFields: {
            additionalProperties: false,
            required: ['colorCode'],
            properties: {
                colorCode: {type: 'string'},
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
 * Create an Operator scope using the provided API key.
 *
 * @param {object} config - Config file contents.
 * @returns {Promise} Promise that resolves to the initialised Operator scope.
 */
const getOperator = async (config) => {
    const cliConfig = cli.getConfig();

    const operators = cliConfig.get('operators');
    const {region, apiKey} = operators[cliConfig.get('using')];

    evrythng.setup({
        apiUrl: cliConfig.get('regions')[region],
        defaultShortDomain: config.output.defaultShortDomain || DEFAULT_SHORT_DOMAIN,
    });

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
const load = async (configPath, csvPath, validateOnly, batchSize) => {
    let config;
    try {
        config = util.loadFile(configPath);
        util.validate(CONFIG_SCHEMA, config, configPath);

        // Initialise EVRYTHNG scope and project
        const operator = await getOperator(config);
        const project = await platform.loadProject(operator, config);

        // Load and validate CSV file data
        const inputSchema = util.loadFile(config.input.schema);
        const inputData = util.loadFile(csvPath, false);
        const csvRecords = await util.loadCsvRecords(inputData, inputSchema);

        log('CSV Records loaded in memory');
        log(' Valid records ' + csvRecords.valid.length);
        log(' Invalid records ' + csvRecords.invalid.length);

        if (!validateOnly) {
            // Map records to EVRYTHNG resources
            const mapping = util.loadFile(config.output.mapping);
            const resources = csvRecords.valid.map(p => mapper.mapRecordToResource(p, mapping));

            // Apply changes
            const outputSchema = util.loadFile(config.output.schema);
            await platform.upsertAllResources(operator, config, resources, project, outputSchema, batchSize);
        }

        csvRecords.invalid.forEach((record, i) => {
            log('('+ record.count + ')' + JSON.stringify(record), 'invalid-csv-records');
        });

        log(`Complete!`);
    } catch (e) {
        log(e);
    }
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
    log(`Wrote example config files to ./${EXAMPLE_CONFIG_DIR}`);
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
        firstArg: 'csv-loader',
        operations: {
            init: {
                execute: async () => writeExampleFiles(),
                pattern: 'init',
            },
            load: {
                execute: async ([, configPath, csvPath, validateOnly, batchSize]) => load(configPath, csvPath, validateOnly, batchSize),
                pattern: 'load $configPath $csvPath $validateOnly',
            },
        },
    };

    api.registerCommand(newCommand);
};
