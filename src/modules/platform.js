const retry = require('p-retry');
const request = require('request');
const fs = require('fs');
const util = require('./util');

/** Parallel operations at a time. */
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
 * Wrapper for retry() functions that use AbortError.
 *
 * @param {function} f - The function.
 * @returns {Promise<object>} Result of the operation.
 */
const retryApi = f => retry(async () => {
  try {
    const obj = await f();
    return obj;
  } catch (e) {
    throw new retry.AbortError(e.message || e.errors[0]);
  }
});

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
  const { type, updateKey, defaultRedirectUrl, qrCodesOptions } = config.output;

  // Assume update by 'name'
  let finalUpdateKey = resource.name;

  // If not, update by nominated identifiers key instead
  if (updateKey !== 'name') {
    finalUpdateKey = { [updateKey]: resource.identifiers[updateKey] };
  }

  try {
    // Validate
    util.validate(outputSchema, resource, resource.name);

    // Remember any special fields
    const specials = {};
    if (resource.redirection) {
      specials.redirection = resource.redirection;
      delete resource.redirection;
    }

    // Upsert
    const res = await retryApi(() => operator[type]().upsert(resource, finalUpdateKey));

    // Apply project scope
    const payload = { scopes: { projects: [`+${project.id}`] } };
    await retryApi(() => operator[type](res.id).update(payload));

    // Redirection?
    if (defaultRedirectUrl || specials.redirection) {
      const url = specials.redirection || defaultRedirectUrl;
      let redirection = await retryApi(
        () => operator[type](res.id).redirection().update({ defaultRedirectUrl: url })
      );

      if (qrCodesOptions){
          await retryApi( () => downloadQrCode(qrCodesOptions,res,redirection));
      }
    }
  } catch (e) {
    console.log(''+ e);
  }
};

/**
 * Retrieves the QR code of the product and stores the file locally
 *
 * @param {object} resource - Resource with a redirection.
 * @param {object} redirection - The redirection object.
 */
const downloadQrCode = async (qrCodesOptions, resource, redirection) => new Promise(async (resolve) => {
    if(!redirection) return;

    const name = resource.name.split(' ').join('_').split('/').join('');
    const qrcodePath = `./qr-codes/${resource.name}-${redirection.shortId}.${qrCodesOptions.split('?')[0]}`;
    console.log(`https://${redirection.shortDomain}/${redirection.shortId}.${qrCodesOptions}`);
    await retryApi( () => request({
        url: `https://${redirection.shortDomain}/${redirection.shortId}.${qrCodesOptions}`,
        //headers: { accept: 'image/svg+xml' }
    }).pipe(fs.createWriteStream(qrcodePath))
        .on('close', resolve)
        .on('error', err => console.log(err)));
});


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
