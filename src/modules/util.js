const fs = require('fs');
const jsonschema = require('jsonschema');
const neatCsv = require('neat-csv');
const log = require('./log').log;

/**
 * Validate a file meets a schema.
 *
 * @param {object} schema - The schema.
 * @param {object} instance - File data.
 * @param {string} name - Instance name.
 */
const validate = (schema, instance, name) => {
    const res = jsonschema.validate(instance, schema);
    if (res.errors.length) {
        const errStacks = res.errors.map(p => `\n- ${p.stack}`);
        throw new Error(`Schema validation failed: ${name}\n${errStacks}`);
    }
};

/**
 * Update the last line with some progress.
 *
 * @param {string} label - The task description.
 * @param {number} num - The current progress value.
 * @param {number} total - The task total to do.
 */
const updateProgress = (label, num, total) => {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(`${label}: ${num}/${total} (${Math.round((num * 100) / total)}%)`);
};

/**
 * Load a single file, optionally parsing as JSON.
 *
 * @param {string} path - File path.
 * @param {boolean} [json] - true to parse as JSON.
 * @returns {*} File content.
 */
const loadFile = (path, json = true) => {
    try {
        const data = fs.readFileSync(path, 'utf8');
        return json ? JSON.parse(data) : data;
    } catch (e) {
        log(`Failed to load ${path}`);
    }
};

/**
 * When a CSV file decoded has duplicate headers, neat-csv uses U+FEFF to include both.
 * We don't want this, so need to remove it in order to deduplicate the keys.
 *
 * Note: It is assumed both keys have the same data.
 *
 * @param {object} record - The record beign deduplicated.
 * @returns {object} New record with duplicate key data removed.
 */
const removeDuplicateKeys = (record) => {
    // Trim away the special whitespace
    const keys = Object.keys(record).map(p => p.trim());
    // Create a set of unique keys
    const newKeys = [...new Set(keys)];

    // Report the offending keys
    // const duplicateKeys = Object.keys(record).filter(p => !newKeys.includes(p));

    // Create a record without the duplicate keys
    const newObj = {};
    newKeys.forEach((p) => {
        newObj[p] = record[p];
    });
    return newObj;
};

/**
 * Load the CSV data and validate all objects meet the input schema.
 *
 * @param {string} inputData - Data read from CSV file.
 * @param {object} inputSchema - Input schema.
 * @returns {object[]} List of record objects.
 */
const loadCsvRecords = async (inputData, inputSchema) => {
    // Validate every record meets the input schema

    let records = await neatCsv(inputData);

    // If the CSV contains duplicate header names, the first is taken.
    records = records.map(removeDuplicateKeys);

    // Validate every record meets the input schema
    console.log('Validating ' + records.length + ' records...');

    let validRecords = [];
    let invalidRecords = [];
    let count = 0;
    records.forEach((object, i) => {
        try {
            validate(inputSchema, object, `Record ${i}`);
            validRecords.push(object);
            //console.log( `(${count++}) [VALID] ${JSON.stringify(object)}`);
            console.log( `(${count++}) [VALID]`);
        }
        catch (error) {
            object.count = count;
            invalidRecords.push(object);
            console.log( `(${count++}) [INVALID]`);

        }
    });

    let result ={
        valid:validRecords,
        invalid:invalidRecords
    };
    return result;
};

module.exports = {
    validate,
    updateProgress,
    removeDuplicateKeys,
    loadFile,
    loadCsvRecords,
};
