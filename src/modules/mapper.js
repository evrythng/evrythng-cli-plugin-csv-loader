/**
 * Map each object using the mapping from CSV headers to EVRYTHNG field names.
 *
 * @param {object} record - The record to map.
 * @param {object} mapping - The mapping object.
 */
const mapRecordToResource = (record, mapping) => {
  const resource = {};

  // CSV records are flat objects
  Object.entries(record).forEach(([key, value]) => {
    // All CSV headings must be catered for
    if (!mapping[key]) {
      throw new Error(`No mapping specified for ${key}`);
    }

    // Split 'customFields.foo' into ['customFields', 'foo']
    let targetKey = mapping[key];
    if (targetKey.includes('.')) {
      targetKey = targetKey.split('.');
      if (targetKey.length !== 2) {
        throw new Error(`Invalid key mapping result from ${mapping[key]}`);
      }
    }

    // Handle arrays (photos, tags, categories)
    // mapping.json should specify indices (i.e: 'tags[0]')
    if (targetKey.includes('[')) {
      const fieldName = targetKey.split('[')[0];
      if (!resource[fieldName]) {
        resource[fieldName] = [];
      }

      const index = Number(targetKey.split('[')[1].split(']')[0]);
      resource[fieldName][index] = value;
      return;
    }

    // Save the mapped value. If there are two elements, it's in a sub-object.
    // Note: won't work with two-character fields, but none are known in EVRYTHNG
    if (targetKey.length === 2) {
      const [objectName, fieldName] = targetKey;
      if (!resource[objectName]) {
        resource[objectName] = {};
      }

      resource[objectName][fieldName] = value;
      return;
    }

    resource[targetKey] = value;
  });

  // Sanity check
  if (!resource.name) {
    throw new Error('EVRYTHNG resource mapped must have a \'name\'');
  }

  return resource;
};

module.exports = {
  mapRecordToResource,
};
