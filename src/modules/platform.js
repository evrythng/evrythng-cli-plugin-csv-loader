const retry = require('p-retry');
const util = require('./util');

const BATCH_SIZE = 10;

/**
 * Load the EVRYTHNG project, creating if neccessary.
 *
 * @param {object} operator - Operator scope.
 * @param {object} config - The config.
 * @returns {object} The project.
 */
const loadProject = async (operator, config) => {
  const { projectName } = config.output;
  const project = await operator.project().upsert({ name: projectName }, projectName);
  console.log(`Using project ${project.id}`);

  return project;
};

/**
 * Upsert a single resource.
 *
 * @param {object} resource - The resource to create or update.
 * @param {object} config - The config scope.
 * @param {object} operator - Operator scope.
 * @param {object} project - The project to scope to.
 * @param {object} outputSchema - The output schema.
 */
const upsertResource = async (resource, config, operator, project, outputSchema) => {
  const { type, updateKey } = config.output;

  // Assume update by 'name'
  let finalUpdateKey = resource.name;

  // If not, update by nominated identifiers key instead
  if (updateKey !== 'name') {
    finalUpdateKey = { [updateKey]: resource.identifiers[updateKey] };
  }

  try {
    // Validate
    util.validate(outputSchema, resource, resource.name);

    // Upsert
    const res = await retry(async () => {
      try {
        const obj = await operator[type]().upsert(resource, finalUpdateKey);
        return obj;
      } catch (e) {
        console.log(e);
        throw new retry.AbortError(e);
      }
    });

    // Apply project scope
    const payload = { scopes: { projects: [`+${project.id}`] } };
    await retry(() => operator[type](res.id).update(payload));
  } catch (e) {
    console.log(e);
  }
};

/**
 * Upsert a list of resources, BATCH_SIZE at a time.
 *
 * @param {object} operator - Operator scope.
 * @param {object} config - The config.
 * @param {object[]} resources - The resources to upsert.
 * @param {object} project - The project to scope to.
 * @param {object} outputSchema - The output schema.
 */
const upsertAllResources = async (operator, config, resources, project, outputSchema) => {
  const total = resources.length;
  let processed = 0;
  while (resources.length) {
    const batch = resources.splice(0, BATCH_SIZE);
    await Promise.all(batch.map(p => upsertResource(p, config, operator, project, outputSchema)));

    processed += BATCH_SIZE;
    util.updateProgress('Creating/updating resources', processed, total);
  }

  util.updateProgress('Creating/updating objects', total, total);
};

module.exports = {
  loadProject,
  upsertResource,
  upsertAllResources,
};
