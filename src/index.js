const fs = require('fs');
const util = require('./modules/util');
const platform = require('./modules/platform');
const stats = require('./modules/stats');
const mapper = require('./modules/mapper');

const CONFIG_SCHEMA = require(`${__dirname}/schema/config.schema.json`);
const [CONFIG_PATH] = process.argv.slice(2);

/**
 * Write the stats object to file.
 *
 * @param {object} config - The config.
 */
const writeStats = (config) => {
  let outputStr = `Loaded ${config.input.data} on ${new Date().toISOString()}\n`;
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
 * Main function.
 */
const main = async () => {
  const config = util.loadFile(CONFIG_PATH);

  try {
    util.validate(CONFIG_SCHEMA, config, CONFIG_PATH);

    // Initialise EVRYTHNG scope and project
    const { OPERATOR_API_KEY } = process.env;
    if (!OPERATOR_API_KEY) {
      throw new Error('Export OPERATOR_API_KEY');
    }
    const operator = await platform.loadOperator(OPERATOR_API_KEY);
    const project = await platform.loadProject(operator, config);

    // Load and validate CSV file data
    const inputSchema = util.loadFile(config.input.schema);
    const inputData = util.loadFile(config.input.data, false);
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
    stats.errors(e.message || e.errors[0]);
  }

  writeStats(config);
};

main();
